const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Review = require('../models/review');
const Order = require('../models/order');
const { requireSession } = require('../middleware/sessionAuth');

function toClientReview(review) {
    const customer = review.customerID;
    const order = review.orderID;
    return {
        id: String(review._id),
        userId: String(customer?._id || customer),
        orderId: order?.orderNumber || String(order?._id || order),
        productId: String(review.productID),
        author: review.customerName || customer?.name || 'Customer',
        target: review.productName,
        comment: review.comments,
        date: review.createdAt
    };
}

router.post('/submit', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can submit reviews.' });
    }

    const { orderID, productID, comments } = req.body || {};
    if (!mongoose.isValidObjectId(orderID) || !mongoose.isValidObjectId(productID) ||
        typeof comments !== 'string' || !comments.trim()) {
        return res.status(400).json({ error: 'A delivered order, product, and review comment are required.' });
    }

    try {
        const order = await Order.findOne({
            _id: orderID,
            customerID: req.authUser._id,
            orderStatus: 'Delivered',
            'items.productID': productID
        }).lean();
        if (!order) {
            return res.status(400).json({ error: 'You can only review a product from your delivered orders.' });
        }

        const purchasedItem = order.items.find(item => String(item.productID) === String(productID));
        const savedReview = await Review.create({
            customerID: req.authUser._id,
            customerName: req.authUser.name,
            orderID: order._id,
            productID,
            productName: purchasedItem.productName,
            comments: comments.trim()
        });
        return res.status(201).json({ message: 'Review saved successfully.', review: toClientReview(savedReview) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'You have already reviewed this product from that order.' });
        }
        console.error('Could not save product review:', error);
        return res.status(500).json({ error: 'Could not save your review.' });
    }
});

router.get('/', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can view product reviews.' });
    }

    try {
        const reviews = await Review.find({ deletedAt: null })
            .populate('customerID', 'name')
            .populate('orderID', 'orderNumber')
            .sort({ createdAt: -1 })
            .lean();
        return res.status(200).json(reviews.map(toClientReview));
    } catch (error) {
        console.error('Could not load product reviews:', error);
        return res.status(500).json({ error: 'Could not load product reviews.' });
    }
});

router.put('/:id', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can update reviews.' });
    }
    if (!mongoose.isValidObjectId(req.params.id) ||
        typeof req.body?.comments !== 'string' || !req.body.comments.trim()) {
        return res.status(400).json({ error: 'A valid review ID and comment are required.' });
    }

    try {
        const updatedReview = await Review.findOneAndUpdate(
            { _id: req.params.id, customerID: req.authUser._id, deletedAt: null },
            { $set: { comments: req.body.comments.trim() } },
            { new: true, runValidators: true }
        ).populate('customerID', 'name').populate('orderID', 'orderNumber');
        if (!updatedReview) {
            return res.status(404).json({ error: 'Review not found.' });
        }
        return res.status(200).json({ message: 'Review updated successfully.', review: toClientReview(updatedReview) });
    } catch (error) {
        console.error('Could not update product review:', error);
        return res.status(500).json({ error: 'Could not update your review.' });
    }
});

router.delete('/:id', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customers can delete reviews.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid review ID.' });
    }

    try {
        const archivedReview = await Review.findOneAndUpdate({
            _id: req.params.id,
            customerID: req.authUser._id,
            deletedAt: null
        }, { $set: { deletedAt: new Date() } });
        if (!archivedReview) {
            return res.status(404).json({ error: 'Review not found.' });
        }
        return res.status(200).json({ message: 'Review archived successfully.' });
    } catch (error) {
        console.error('Could not archive product review:', error);
        return res.status(500).json({ error: 'Could not archive your review.' });
    }
});

module.exports = router;