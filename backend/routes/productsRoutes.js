const express = require('express');
const router = express.Router();
const Product = require('../models/product'); // Make sure casing matches your file (product.js)

// 1. POST: Add a new product
router.post('/add', async (req, res) => {
    try {
        const { vendorID, productName, price, stock } = req.body;
        if (!vendorID || !productName || price === undefined || stock === undefined) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newProduct = new Product({ vendorID, productName, price, stock });
        const savedProduct = await newProduct.save();
        res.status(201).json({ message: 'Product added successfully', product: savedProduct });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Retrieve all products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().populate('vendorID', 'name contactNumber');
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update a product by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Remove a product by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;