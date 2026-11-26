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

function isValidPhotoData(imageData) {
    return typeof imageData === 'string' &&
        imageData.length <= 1500000 &&
        /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData);
}

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
            stockUnit: item.stockUnit,
            returnRequest: item.returnRequest ? {
                reason: item.returnRequest.reason,
                proofImageData: item.returnRequest.proofImageData,
                status: item.returnRequest.status,
                requestedAt: item.returnRequest.requestedAt,
                reviewedAt: item.returnRequest.reviewedAt
            } : null
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
        deliveryFailureAt: order.deliveryFailureAt,
        deliveryFailureReason: order.deliveryFailureReason,
        deliveryProof: (order.deliveryProof || []).map(photo => ({
            imageData: photo.imageData,
            uploadedAt: photo.uploadedAt
        })),
        unsuccessfulDeliveryReport: order.unsuccessfulDeliveryReport ? {
            courierName: order.unsuccessfulDeliveryReport.courierName,
            reason: order.unsuccessfulDeliveryReport.reason,
            reportedAt: order.unsuccessfulDeliveryReport.reportedAt
        } : null,
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

router.post('/:id/report-unsuccessful-delivery', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can report an unsuccessful delivery.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 1000) {
        return res.status(400).json({ error: 'Please provide a report reason between 5 and 1000 characters.' });
    }

    try {
        const existingOrder = await Order.findOne({
            _id: req.params.id,
            customerID: req.authUser._id
        }).lean();
        if (!existingOrder) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        if (existingOrder.unsuccessfulDeliveryReport) {
            return res.status(409).json({ error: 'An unsuccessful delivery report has already been submitted for this order.' });
        }
        if (!['Out for Delivery', 'Delivered', 'Unsuccessful Delivery'].includes(existingOrder.orderStatus) || !existingOrder.courierID) {
            return res.status(409).json({ error: 'You can report the assigned rider during or after the delivery.' });
        }

        const order = await Order.findOneAndUpdate(
            {
                _id: existingOrder._id,
                customerID: req.authUser._id,
                orderStatus: { $in: ['Out for Delivery', 'Delivered', 'Unsuccessful Delivery'] },
                courierID: existingOrder.courierID,
                unsuccessfulDeliveryReport: null
            },
            {
                $set: {
                    unsuccessfulDeliveryReport: {
                        customerID: req.authUser._id,
                        courierID: existingOrder.courierID,
                        courierName: existingOrder.courierName,
                        reason,
                        reportedAt: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );
        if (!order) {
            return res.status(409).json({ error: 'This order changed before the report could be submitted. Please refresh and try again.' });
        }

        return res.status(201).json({
            message: 'Your unsuccessful delivery report has been submitted.',
            order: toClientOrder(order)
        });
    } catch (error) {
        console.error('Could not submit unsuccessful delivery report:', error);
        return res.status(500).json({ error: 'Could not submit your delivery report.' });
    }
});

router.post('/:id/items/:productId/return-request', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can request product returns.' });
    }
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ error: 'Invalid order or product ID.' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const proofImageData = typeof req.body?.proofImageData === 'string' ? req.body.proofImageData : '';
    if (reason.length < 5 || reason.length > 1000) {
        return res.status(400).json({ error: 'Please provide a return reason between 5 and 1000 characters.' });
    }
    if (!isValidPhotoData(proofImageData)) {
        return res.status(400).json({ error: 'Upload a valid JPG, PNG, or WEBP product photo up to 1 MB.' });
    }

    try {
        const existingOrder = await Order.findOne({
            _id: req.params.id,
            customerID: req.authUser._id
        }).lean();
        if (!existingOrder) {
            return res.status(404).json({ error: 'Order not found.' });
        }
        if (existingOrder.orderStatus !== 'Delivered') {
            return res.status(409).json({ error: 'A return can only be requested for a delivered order.' });
        }

        const productId = new mongoose.Types.ObjectId(req.params.productId);
        const existingItem = existingOrder.items.find(item => String(item.productID) === String(productId));
        if (!existingItem) {
            return res.status(404).json({ error: 'Product not found in this order.' });
        }
        if (existingItem.returnRequest) {
            return res.status(409).json({ error: 'A return request has already been submitted for this product.' });
        }

        const order = await Order.findOneAndUpdate(
            {
                _id: existingOrder._id,
                customerID: req.authUser._id,
                orderStatus: 'Delivered',
                items: {
                    $elemMatch: {
                        productID: productId,
                        returnRequest: null
                    }
                }
            },
            {
                $set: {
                    'items.$.returnRequest': {
                        customerID: req.authUser._id,
                        reason,
                        proofImageData,
                        status: 'Pending Vendor Approval',
                        requestedAt: new Date(),
                        reviewedAt: null
                    }
                }
            },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'This product changed before the return request could be submitted. Please refresh and try again.' });
        }

        return res.status(201).json({
            message: 'Your return request and product photo were sent to the vendor for approval.',
            order: toClientOrder(order)
        });
    } catch (error) {
        console.error('Could not submit product return request:', error);
        return res.status(500).json({ error: 'Could not submit the product return request.' });
    }
});

router.put('/:id/items/:productId/return-request/proof', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can replace return photo proof.' });
    }
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ error: 'Invalid order or product ID.' });
    }
    const proofImageData = req.body?.proofImageData;
    if (!isValidPhotoData(proofImageData)) {
        return res.status(400).json({ error: 'Upload a valid JPG, PNG, or WEBP product photo up to 1 MB.' });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                customerID: req.authUser._id,
                orderStatus: 'Delivered',
                items: {
                    $elemMatch: {
                        productID: new mongoose.Types.ObjectId(req.params.productId),
                        'returnRequest.status': 'Pending Vendor Approval'
                    }
                }
            },
            { $set: { 'items.$.returnRequest.proofImageData': proofImageData } },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'Only a pending return request for your delivered order can have its photo replaced.' });
        }

        return res.status(200).json({
            message: 'Return proof photo replaced successfully.',
            order: toClientOrder(order)
        });
    } catch (error) {
        console.error('Could not replace product return proof photo:', error);
        return res.status(500).json({ error: 'Could not replace the product return proof photo.' });
    }
});

router.put('/:id/items/:productId/return-request', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Vendor') {
        return res.status(403).json({ error: 'Only the product vendor can review a return request.' });
    }
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ error: 'Invalid order or product ID.' });
    }

    const status = req.body?.status;
    if (!['Approved', 'Declined'].includes(status)) {
        return res.status(400).json({ error: 'Choose whether to approve or decline this return request.' });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                orderStatus: 'Delivered',
                items: {
                    $elemMatch: {
                        productID: new mongoose.Types.ObjectId(req.params.productId),
                        vendorID: req.authUser._id,
                        'returnRequest.status': 'Pending Vendor Approval'
                    }
                }
            },
            {
                $set: {
                    'items.$.returnRequest.status': status,
                    'items.$.returnRequest.reviewedAt': new Date()
                }
            },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'This return request is no longer pending or does not belong to your vendor account.' });
        }

        return res.status(200).json({
            message: status === 'Approved'
                ? 'Return approved. The customer should return the product directly to your vendor location.'
                : 'Return request declined.',
            order: toClientOrder(order)
        });
    } catch (error) {
        console.error('Could not review product return request:', error);
        return res.status(500).json({ error: 'Could not review this product return request.' });
    }
});

router.put('/:id/delivery-proof', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Rider') {
        return res.status(403).json({ error: 'Only the assigned rider can replace delivery proof.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const proofImageData = req.body?.proofImageData;
    if (!isValidPhotoData(proofImageData)) {
        return res.status(400).json({ error: 'Upload a valid JPG, PNG, or WEBP delivery photo up to 1 MB.' });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                orderStatus: 'Delivered',
                courierID: req.authUser._id
            },
            {
                $set: {
                    deliveryProof: [{ imageData: proofImageData, uploadedAt: new Date() }]
                }
            },
            { new: true, runValidators: true }
        ).lean();
        if (!order) {
            return res.status(409).json({ error: 'Only the assigned rider can replace proof for a delivered order.' });
        }

        return res.status(200).json({
            message: 'Delivery proof photo replaced successfully.',
            order: toClientOrder(order)
        });
    } catch (error) {
        console.error('Could not replace rider delivery proof:', error);
        return res.status(500).json({ error: 'Could not replace the delivery proof photo.' });
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
            const deliveryProof = req.body?.deliveryProof;
            if (!isValidPhotoData(deliveryProof)) {
                return res.status(400).json({ error: 'Upload a JPG, PNG, or WEBP delivery photo up to 1 MB before marking this order delivered.' });
            }

            const deliveryConfirmedAt = new Date();
            const order = await Order.findOneAndUpdate(
                {
                    _id: req.params.id,
                    orderStatus: 'Out for Delivery',
                    courierID: req.authUser._id
                },
                {
                    $set: {
                        orderStatus: status,
                        deliveryConfirmedAt,
                        deliveryProof: [{ imageData: deliveryProof, uploadedAt: deliveryConfirmedAt }]
                    }
                },
                { new: true, runValidators: true }
            ).lean();
            if (!order) {
                return res.status(409).json({ error: 'This delivery cannot be completed by your rider account.' });
            }
            await syncDeliveryRecord(order, 'delivered');
            return res.status(200).json({ order: toClientOrder(order) });
        }

        if (status === 'Unsuccessful Delivery') {
            const order = await Order.findOneAndUpdate(
                {
                    _id: req.params.id,
                    orderStatus: 'Out for Delivery',
                    courierID: req.authUser._id
                },
                {
                    $set: {
                        orderStatus: status,
                        deliveryFailureAt: new Date(),
                        deliveryFailureReason: 'Customer unavailable to receive the order.'
                    }
                },
                { new: true, runValidators: true }
            ).lean();
            if (!order) {
                return res.status(409).json({ error: 'This delivery cannot be marked unsuccessful by your rider account.' });
            }
            await syncDeliveryRecord(order, 'failed');
            return res.status(200).json({ order: toClientOrder(order) });
        }

        return res.status(400).json({ error: 'Choose a valid order status.' });
    } catch (error) {
        console.error('Could not update order status:', error);
        return res.status(500).json({ error: 'Could not update order status.' });
    }
});

module.exports = router;
