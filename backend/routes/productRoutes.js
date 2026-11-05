const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/product');
const { requireSession } = require('../middleware/sessionAuth');

const router = express.Router();
const validCategories = ['Fish', 'Meat', 'Vegetables', 'Fruits', 'Spices'];

function toClientProduct(product) {
    const vendor = product.vendorID && typeof product.vendorID === 'object'
        ? product.vendorID
        : null;
    const vendorId = String(vendor?._id || product.vendorID);
    const stallNumber = String(vendor?.stallNumber || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const stallName = String(vendor?.stallName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const businessId = stallNumber && stallName
        ? `stall:${stallNumber}|${stallName}`
        : `vendor:${vendorId}`;

    return {
        id: String(product._id),
        vendorId,
        vendorName: vendor?.stallName || 'AtudTA Market Vendor',
        businessId,
        name: product.productName,
        price: product.price,
        stock: product.stock,
        stockUnit: product.stockUnit,
        category: product.category || 'Vegetables',
        imageData: product.imageData || '',
        inStock: product.inStock !== false && product.stock > 0
    };
}

function validateProductInput(body) {
    if (!body || typeof body !== 'object') {
        return 'Product details are required.';
    }
    const { productName, price, stock, stockUnit, category, imageData } = body;
    if (typeof productName !== 'string' || !productName.trim()) {
        return 'Product name is required.';
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        return 'Price must be a non-negative number.';
    }
    if (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0 ||
        Math.abs(stock * 100 - Math.round(stock * 100)) > 1e-8) {
        return 'Stock must be a non-negative number with up to 2 decimal places.';
    }
    if (stockUnit === 'piece' && !Number.isInteger(stock)) {
        return 'Piece stock must be a whole number.';
    }
    if (!['piece', 'kg'].includes(stockUnit)) {
        return 'Stock unit must be piece or kg.';
    }
    if (!validCategories.includes(category)) {
        return 'Choose a valid product category.';
    }
    if (imageData !== undefined &&
        (typeof imageData !== 'string' || imageData.length > 1_500_000 ||
            (imageData && !/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(imageData)))) {
        return 'Product image must be a supported image smaller than 1 MB.';
    }
    return null;
}

async function restoreReservedStock(reserved) {
    for (const reservation of reserved) {
        const result = await Product.updateOne(
            { _id: reservation.productId },
            { $inc: { stock: reservation.quantity } }
        );
        if (result.matchedCount !== 1) {
            throw new Error(`Could not restore reserved stock for product ${reservation.productId}.`);
        }
    }
}

async function addProduct(req, res) {
    if (req.authUser.role !== 'Vendor') {
        return res.status(403).json({ error: 'Only vendor accounts can add products.' });
    }
    const validationError = validateProductInput(req.body);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const product = await Product.create({
            vendorID: req.authUser._id,
            productName: req.body.productName.trim(),
            price: req.body.price,
            stock: req.body.stock,
            stockUnit: req.body.stockUnit,
            category: req.body.category,
            imageData: req.body.imageData || '',
            inStock: req.body.stock > 0
        });
        await product.populate('vendorID', 'name stallName stallNumber contactNumber');
        return res.status(201).json({ product: toClientProduct(product) });
    } catch (error) {
        console.error('Could not save product:', error);
        return res.status(500).json({ error: 'Could not save the product to the database.' });
    }
}

router.get('/', async (req, res) => {
    try {
        const products = await Product.find()
            .populate('vendorID', 'name stallName stallNumber contactNumber')
            .sort({ createdAt: -1 })
            .lean();
        return res.status(200).json(products.map(toClientProduct));
    } catch (error) {
        console.error('Could not load products:', error);
        return res.status(500).json({ error: 'Could not load products from the database.' });
    }
});

router.post('/', requireSession, addProduct);
router.post('/add', requireSession, addProduct);

router.put('/:id', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Vendor') {
        return res.status(403).json({ error: 'Only vendor accounts can update products.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const validationError = validateProductInput(req.body);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, vendorID: req.authUser._id },
            {
                productName: req.body.productName.trim(),
                price: req.body.price,
                stock: req.body.stock,
                stockUnit: req.body.stockUnit,
                category: req.body.category,
                imageData: req.body.imageData || '',
                inStock: req.body.inStock === undefined ? req.body.stock > 0 : Boolean(req.body.inStock)
            },
            { new: true, runValidators: true }
        ).populate('vendorID', 'name stallName stallNumber contactNumber');
        if (!product) {
            return res.status(404).json({ error: 'Product not found for this vendor.' });
        }
        return res.status(200).json({ product: toClientProduct(product) });
    } catch (error) {
        console.error('Could not update product:', error);
        return res.status(500).json({ error: 'Could not update the product in the database.' });
    }
});

router.delete('/:id', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Vendor') {
        return res.status(403).json({ error: 'Only vendor accounts can delete products.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
    }

    try {
        const product = await Product.findOneAndDelete({
            _id: req.params.id,
            vendorID: req.authUser._id
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found for this vendor.' });
        }
        return res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        console.error('Could not delete product:', error);
        return res.status(500).json({ error: 'Could not delete the product from the database.' });
    }
});

router.post('/reserve-stock', requireSession, async (req, res) => {
    if (req.authUser.role !== 'Customer') {
        return res.status(403).json({ error: 'Only customer accounts can place product orders.' });
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
        return res.status(400).json({ error: 'At least one product is required.' });
    }

    const quantities = new Map();
    for (const item of req.body.items) {
        if (!item || !mongoose.isValidObjectId(item.productId) ||
            typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 ||
            Math.abs(item.quantity * 100 - Math.round(item.quantity * 100)) > 1e-8) {
            return res.status(400).json({ error: 'Each order item needs a valid product ID and quantity.' });
        }
        const current = quantities.get(item.productId) || { quantity: 0, requiresKilograms: false };
        current.quantity = Math.round((current.quantity + item.quantity) * 100) / 100;
        current.requiresKilograms ||= !Number.isInteger(item.quantity);
        quantities.set(item.productId, current);
    }

    const reserved = [];
    try {
        for (const [productId, { quantity, requiresKilograms }] of quantities) {
            const stockFilter = requiresKilograms ? { stockUnit: 'kg' } : {};
            const product = await Product.findOneAndUpdate(
                { _id: productId, stock: { $gte: quantity }, inStock: true, ...stockFilter },
                { $inc: { stock: -quantity } },
                { new: true, runValidators: true }
            );
            if (!product) {
                try {
                    await restoreReservedStock(reserved);
                } catch (rollbackError) {
                    console.error('Could not roll back a partial stock reservation:', rollbackError);
                    return res.status(500).json({ error: 'Stock reservation failed and needs database review.' });
                }
                return res.status(409).json({ error: 'A product is out of stock or no longer has enough quantity.' });
            }
            reserved.push({ productId, quantity });
        }

        const products = await Product.find({ _id: { $in: [...quantities.keys()] } })
            .populate('vendorID', 'name stallName stallNumber contactNumber')
            .lean();
        return res.status(200).json({ products: products.map(toClientProduct) });
    } catch (error) {
        try {
            await restoreReservedStock(reserved);
        } catch (rollbackError) {
            console.error('Could not roll back a partial stock reservation:', rollbackError);
        }
        console.error('Could not reserve product stock:', error);
        return res.status(500).json({ error: 'Could not reserve product stock.' });
    }
});

module.exports = router;
