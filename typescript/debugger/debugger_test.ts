// Define types/interfaces to match Python's dataclasses
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface InvoiceSummary {
  itemsProcessed: number;
  subtotal: number;
  finalTotal: number;
  categories: Set<string>;
}

function applyDiscount(price: number, discountRate: number): number {
  // Calculates the discounted price. Good for testing 'step' and 'return'.
  const reduction = price * discountRate;
  const finalPrice = price - reduction;
  return Math.round(finalPrice * 100) / 100; // JavaScript/TypeScript rounding to 2 decimal places
}

function generateInvoice(
  inventory: Product[],
  discountMapping: Record<string, number>,
): InvoiceSummary {
  // Processes products and aggregates totals.
  const invoiceSummary: InvoiceSummary = {
    itemsProcessed: 0,
    subtotal: 0.0,
    finalTotal: 0.0,
    categories: new Set<string>(),
  };

  for (const item of inventory) {
    // 💡 Try setting a conditional breakpoint here: item.category === 'Electronics'
    invoiceSummary.itemsProcessed += 1;
    invoiceSummary.subtotal += item.price;
    invoiceSummary.categories.add(item.category);

    // Determine if a discount applies to this category (fallback to 0.0 if undefined)
    const rate = discountMapping[item.category] ?? 0.0;

    // 💡 Step 'into' this function or step 'over' it in your IDE debugger
    const itemFinalPrice = applyDiscount(item.price, rate);
    invoiceSummary.finalTotal += itemFinalPrice;
  }

  invoiceSummary.subtotal = Math.round(invoiceSummary.subtotal * 100) / 100;
  invoiceSummary.finalTotal = Math.round(invoiceSummary.finalTotal * 100) / 100;

  return invoiceSummary;
}

// Main execution block
function main() {
  debugger;

  // Sample catalog data
  const catalog: Product[] = [
    { id: 101, name: "Wireless Mouse", price: 29.99, category: "Electronics" },
    {
      id: 102,
      name: "Mechanical Keyboard",
      price: 89.99,
      category: "Electronics",
    },
    { id: 103, name: "Running Shoes", price: 120.0, category: "Apparel" },
    { id: 104, name: "Coffee Mug", price: 15.5, category: "Kitchen" },
  ];

  // Category discount rates (e.g., 10% off electronics, 20% off apparel)
  const discounts: Record<string, number> = {
    Electronics: 0.1,
    Apparel: 0.2,
  };

  console.log("Initializing invoice generation...");

  // 💡 Execution stops here if stepping through
  const report = generateInvoice(catalog, discounts);

  console.log("\n--- Final Invoice Report ---");
  // 💡 Use console.log(report) or console.table(report) to see a beautifully formatted output
  console.log(`Total Items: ${report.itemsProcessed}`);
  console.log(`Subtotal:    $${report.subtotal}`);
  console.log(`Total Due:   $${report.finalTotal}`);
}

// Run the main function
main();
