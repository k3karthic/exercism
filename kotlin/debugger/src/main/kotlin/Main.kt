package com.github.k3karthic.debugger

import kotlin.math.roundToInt

data class Product(
    val id: Int,
    val name: String,
    val price: Double,
    val category: String,
)

data class InvoiceSummary(
    var itemsProcessed: Int,
    var subtotal: Double,
    var finalTotal: Double,
    val categories: MutableSet<String>,
)

/**
 * Calculates the discounted price. Good for testing 'step' (s) and 'return' (r).
 */
fun applyDiscount(
    price: Double,
    discountRate: Double,
): Double {
    val reduction = price * discountRate
    val finalPrice = price - reduction
    return (finalPrice * 100).roundToInt() / 100.0
}

/**
 * Processes products and aggregates totals. Good for testing loops and local variables.
 */
fun generateInvoice(
    inventory: List<Product>,
    discountMapping: Map<String, Double>,
): InvoiceSummary {
    val invoiceSummary =
        InvoiceSummary(
            itemsProcessed = 0,
            subtotal = 0.0,
            finalTotal = 0.0,
            categories = mutableSetOf(),
        )

    for (item in inventory) {
        // conditional breakpoint here: item.category == 'Electronics'
        if (item.category.equals("Electronics")) {
            // stop at com.github.k3karthic.debugger.MainKt:49
            val dummy = true
        }

        invoiceSummary.itemsProcessed += 1
        invoiceSummary.subtotal += item.price
        invoiceSummary.categories.add(item.category)

        // Determine if a discount applies to this category
        val rate = discountMapping.getOrElse(item.category, { 0.0 })

        val itemFinalPrice = applyDiscount(item.price, rate)
        invoiceSummary.finalTotal += itemFinalPrice

        invoiceSummary.subtotal = (invoiceSummary.subtotal * 100).roundToInt() / 100.0
        invoiceSummary.finalTotal = (invoiceSummary.finalTotal * 100).roundToInt() / 100.0
    }

    return invoiceSummary
}

fun main() {
    // stop in com.github.k3karthic.debugger.MainKt.main

    // Sample catalog data
    val catalog =
        listOf(
            Product(id = 101, name = "Wireless Mouse", price = 29.99, category = "Electronics"),
            Product(
                id = 102,
                name = "Mechanical Keyboard",
                price = 89.99,
                category = "Electronics",
            ),
            Product(id = 103, name = "Running Shoes", price = 120.00, category = "Apparel"),
            Product(id = 104, name = "Coffee Mug", price = 15.50, category = "Kitchen"),
        )

    // Category discount rates (e.g., 10% off electronics, 20% off apparel)
    val discounts = mapOf(Pair("Electronics", 0.10), Pair("Apparel", 0.20))

    println("Initializing invoice generation...")

    val report = generateInvoice(catalog, discounts)

    print("\n--- Final Invoice Report ---")
    print("Total Items: ${report.itemsProcessed}")
    print("Subtotal:   ${report.subtotal}")
    print("Total Due:  ${report.finalTotal}")
}
