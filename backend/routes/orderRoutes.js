const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/order');
const Product = require('../models/product');
const Payment = require('../models/payment');
const Delivery = require('../models/delivery');
const { requireSession } = require('../middleware/sessionAuth');

const router = express.Router();
const DELIVERY_FEE = 58;
const ESTIMATED_DELIVERY_MINUTES = 30;
const paymentMethods = ['Cash on Delivery', 'GCash', 'Maya'];

function getBusinessId(vendor) {
    const stallNumber = String(vendor.stallNumber || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const stallName = String(vendor.stallName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return stallNumber && stallName
        ? `stall:${stallNumber}|${stallName}`
        : `vendor:${vendor._id}`;
}

function toClientOrder(order) {
    return {
        databaseId: String(order._id),
        id: order.orderNumber,
        userId: String(order.customerID),
        customerName: order.customerName,
        address: order.address,
        items: (order.items || []).map(item => ({
            productId: String(item.productID),
            vendorId: String(item.vendorID),
            vendorName: item.vendorName,
            businessId: item.businessId,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            stockUnit: item.stockUnit
        })),
        itemsSubtotal: order.itemsSubtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        courierId: order.courierID ? String(order.courierID) : null,
        courierName: order.courierName,
        declinedBy: (order.declinedBy || []).map(id => String(id)),
        packedBy: (order.packedBy || []).map(id => String(id)),
        pickupAt: order.pickupAt,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
        deliveryConfirmedAt: order.deliveryConfirmedAt,
        timestamp: order.createdAt
    };
}

async function restoreStock(reservations) {
    for (const reservation of reservations) {
        const result = await Product.updateOne(
            { _id: reservation.productID },
            { $inc: { stock: reservation.quantity } }
        );
        if (result.matchedCount !== 1) {
            throw new Error(`Could not restore stock for product ${reservation.productID}.`);
        }
    }
}

async function syncDeliveryRecord(order, deliveryStatus) {
    await Delivery.findOneAndUpdate(
        { orderID: order._id },
        {
            $set: {
                deliveryAddress: order.address,
                courierID: order.courierID || null,
                courierName: order.courierName || 'Unassigned',
                deliveryStatus,
                estimatedDeliveryDate: order.estimatedDeliveryAt || new Date(Date.now() + ESTIMATED_DELIVERY_MINUTES * 60 * 1000),
                pickupAt: order.pickupAt || null,
                deliveredAt: order.deliveryConfirmedAt || null
            }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
}

router.post('/place', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customer accounts can place orders.' });
    }

    const { address, paymentMethod, items } = req.body || {};
    if (typeof address !== 'string' || !address.trim()) {
        return res.status(400).json({ error: 'A delivery address is required.' });
    }
    if (!paymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: 'Choose a valid payment method.' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return res.status(400).json({ error: 'Choose between 1 and 50 order items.' });
    }

    const requestedItems = new Map();
    for (const item of items) {
        if (!item || !mongoose.isValidObjectId(item.productId) ||
            typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 ||
            Math.abs(item.quantity * 100 - Math.round(item.quantity * 100)) > 1e-8) {
            return res.status(400).json({ error: 'Each item must have a valid product and quantity.' });
        }
        requestedItems.set(
            item.productId,
            Math.round(((requestedItems.get(item.productId) || 0) + item.quantity) * 100) / 100
        );
    }

    const reservations = [];
    let createdOrder = null;
    try {
        const orderItems = [];
        let itemsSubtotal = 0;
        for (const [productId, quantity] of requestedItems) {
            const product = await Product.findOneAndUpdate(
                { _id: productId, deletedAt: null, stock: { $gte: quantity }, inStock: true },
                { $inc: { stock: -quantity } },
                { new: false, runValidators: true }
            ).populate('vendorID', 'stallName stallNumber');

            if (!product) {
                const error = new Error('A product is out of stock or no longer has enough quantity.');
                error.status = 409;
                throw error;
            }
            reservations.push({ productID: product._id, quantity });
            if (!product.vendorID) {
                throw new Error(`The vendor for product ${productId} could not be found.`);
            }
            if (product.stockUnit === 'piece' && !Number.isInteger(quantity)) {
                const error = new Error('Piece quantities must be whole numbers.');
                error.status = 400;
                throw error;
            }

            const vendor = product.vendorID;
            orderItems.push({
                productID: product._id,
                vendorID: vendor._id,
                productName: product.productName,
                vendorName: vendor.stallName || 'AtudTA Market Vendor',
                businessId: getBusinessId(vendor),
                stockUnit: product.stockUnit,
                quantity,
                price: product.price
            });
            itemsSubtotal += product.price * quantity;
        }

        itemsSubtotal = Math.round(itemsSubtotal * 100) / 100;
        createdOrder = await Order.create({
            orderNumber: `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
            customerID: req.authUser._id,
            customerName: req.authUser.name,
            address: address.trim(),
            items: orderItems,
            itemsSubtotal,
            deliveryFee: DELIVERY_FEE,
            totalAmount: Math.round((itemsSubtotal + DELIVERY_FEE) * 100) / 100,
            paymentStatus: paymentMethod === 'Cash on Delivery' ? 'Pending COD' : 'Paid Digital',
            paymentMethod
        });

        await Payment.create({
            orderID: createdOrder._id,
            customerID: req.authUser._id,
            amount: createdOrder.totalAmount,
            method: createdOrder.paymentMethod,
            paymentStatus: createdOrder.paymentStatus
        });
        await syncDeliveryRecord(createdOrder, 'pending');

        return res.status(201).json({
            message: 'Order created successfully.',
            order: toClientOrder(createdOrder)
        });
    } catch (error) {
        if (createdOrder) {
            try {
                await Promise.all([
                    Payment.deleteOne({ orderID: createdOrder._id }),
                    Delivery.deleteOne({ orderID: createdOrder._id }),
                    Order.deleteOne({ _id: createdOrder._id })
                ]);
            } catch (cleanupError) {
                console.error('Could not remove partial order records:', cleanupError);
                return res.status(500).json({ error: 'Order creation failed and related records need database review.' });
            }
        }
        try {
            await restoreStock(reservations);
        } catch (rollbackError) {
            console.error('Could not restore stock after order creation failed:', rollbackError);
            return res.status(500).json({ error: 'Order creation failed and stock needs database review.' });
        }
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('Could not create order:', error);
        return res.status(500).json({ error: 'Could not save the order to the database.' });
    }
});

router.get('/', requireSession, async (req, res) => {
    let filter;
    if (req.authUser.role === 'Customer') {
        filter = { customerID: req.authUser._id };
    } else if (req.authUser.role === 'Vendor') {
        filter = { 'items.vendorID': req.authUser._id };
    } else if (req.authUser.role === 'Rider') {
        filter = {
            $or: [
                { courierID: req.authUser._id },
                {
                    orderStatus: 'Packed',
                    courierID: null,
                    declinedBy: { $ne: req.authUser._id }
                }
            ]
        };
    } else {
        return res.status(403).json({ error: 'Your account cannot view orders.' });
    }

    try {
        const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
        return res.status(200).json(orders.map(toClientOrder));
    } catch (error) {
        console.error('Could not load orders:', error);
        return res.status(500).json({ error: 'Could not load orders from the database.' });
    }
});

router.put('/:id/accept', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Rider') {
        return res.status(403).json({ error: 'Only riders can accept deliveries.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                orderStatus: 'Packed',
                courierID: null,
                declinedBy: { $ne: req.authUser._id }
            },
            { $set: { courierID: req.authUser._id, courierName: req.authUser.name } },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'This delivery is no longer available to accept.' });
        }
        await syncDeliveryRecord(order, 'pending');
        return res.status(200).json({ order: toClientOrder(order) });
    } catch (error) {
        console.error('Could not accept delivery:', error);
        return res.status(500).json({ error: 'Could not accept this delivery.' });
    }
});

router.put('/:id/decline', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Rider') {
        return res.status(403).json({ error: 'Only riders can decline deliveries.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                orderStatus: 'Packed',
                courierID: null,
                declinedBy: { $ne: req.authUser._id }
            },
            { $addToSet: { declinedBy: req.authUser._id } },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'This delivery is no longer available to decline.' });
        }
        return res.status(200).json({ order: toClientOrder(order) });
    } catch (error) {
        console.error('Could not decline delivery:', error);
        return res.status(500).json({ error: 'Could not decline this delivery.' });
    }
});

router.put('/:id/status', requireSession, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const status = req.body?.status;

    try {
        if (req.authUser.role === 'Vendor' && status === 'Packed') {
            const order = await Order.findOne({
                _id: req.params.id,
                orderStatus: 'Pending',
                'items.vendorID': req.authUser._id
            }).lean();
            if (!order) {
                return res.status(404).json({ error: 'Pending order not found for this vendor.' });
            }
            if (order.packedBy.some(id => String(id) === String(req.authUser._id))) {
                return res.status(409).json({ error: 'Your items in this order are already packed.' });
            }

            await Order.updateOne(
                { _id: order._id, orderStatus: 'Pending' },
                { $addToSet: { packedBy: req.authUser._id } }
            );
            const refreshedOrder = await Order.findById(order._id).lean();
            const vendorIDs = [...new Set(refreshedOrder.items.map(item => String(item.vendorID)))];
            const packedIDs = new Set(refreshedOrder.packedBy.map(id => String(id)));
            if (vendorIDs.every(id => packedIDs.has(id))) {
                await Order.updateOne(
                    { _id: order._id, orderStatus: 'Pending' },
                    { $set: { orderStatus: 'Packed' } }
                );
            }
            const updatedOrder = await Order.findById(order._id).lean();
            return res.status(200).json({ order: toClientOrder(updatedOrder) });
        }

        if (req.authUser.role !== 'Rider') {
            return res.status(403).json({ error: 'Your account cannot update this order status.' });
        }

        if (status === 'Out for Delivery') {
            const pickupAt = new Date();
            const estimatedDeliveryAt = new Date(
                pickupAt.getTime() + ESTIMATED_DELIVERY_MINUTES * 60 * 1000
            );
            const order = await Order.findOneAndUpdate(
                {
                    _id: req.params.id,
                    orderStatus: 'Packed',
                    courierID: req.authUser._id
                },
                { $set: { orderStatus: status, pickupAt, estimatedDeliveryAt } },
                { new: true, runValidators: true }
            ).lean();
            if (!order) {
                return res.status(409).json({ error: 'This delivery cannot be started by your rider account.' });
            }
            await syncDeliveryRecord(order, 'in_transit');
            return res.status(200).json({ order: toClientOrder(order) });
        }

        if (status === 'Delivered') {
            const order = await Order.findOneAndUpdate(
                {
                    _id: req.params.id,
                    orderStatus: 'Out for Delivery',
                    courierID: req.authUser._id
                },
                { $set: { orderStatus: status, deliveryConfirmedAt: new Date() } },
                { new: true, runValidators: true }
            ).lean();
            if (!order) {
                return res.status(409).json({ error: 'This delivery cannot be completed by your rider account.' });
            }
            await syncDeliveryRecord(order, 'delivered');
            return res.status(200).json({ order: toClientOrder(order) });
        }

        return res.status(400).json({ error: 'Choose a valid order status.' });
    } catch (error) {
        console.error('Could not update order status:', error);
        return res.status(500).json({ error: 'Could not update order status.' });
    }
});

module.exports = router;
