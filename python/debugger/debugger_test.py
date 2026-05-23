from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Product:
    id: int
    name: str
    price: float
    category: str


@dataclass
class InvoiceSummary:
    items_processed: int
    subtotal: float
    final_total: float
    categories: set[str]


def apply_discount(price: float, discount_rate: float) -> float:
    """Calculates the discounted price. Good for testing 'step' (s) and 'return' (r)."""
    reduction = price * discount_rate
    final_price = price - reduction
    return round(final_price, 2)


def generate_invoice(
    inventory: List[Product], discount_mapping: Dict[str, float]
) -> InvoiceSummary:
    """Processes products and aggregates totals. Good for testing loops and local variables."""
    invoice_summary = InvoiceSummary(
        items_processed=0, subtotal=0.0, final_total=0.0, categories=set()
    )

    for item in inventory:
        # 💡 Try setting a conditional breakpoint here: b 31, item.category == 'Electronics'
        invoice_summary.items_processed += 1
        invoice_summary.subtotal += item.price
        invoice_summary.categories.add(item.category)

        # Determine if a discount applies to this category
        rate = discount_mapping.get(item.category, 0.0)

        # 💡 Step 'into' this function using 's', or step 'over' it using 'n'
        item_final_price = apply_discount(item.price, rate)
        invoice_summary.final_total += item_final_price

    invoice_summary.subtotal = round(invoice_summary.subtotal, 2)
    invoice_summary.final_total = round(invoice_summary.final_total, 2)

    return invoice_summary


if __name__ == "__main__":
    breakpoint()

    # Sample catalog data
    catalog = [
        Product(id=101, name="Wireless Mouse", price=29.99, category="Electronics"),
        Product(
            id=102, name="Mechanical Keyboard", price=89.99, category="Electronics"
        ),
        Product(id=103, name="Running Shoes", price=120.00, category="Apparel"),
        Product(id=104, name="Coffee Mug", price=15.50, category="Kitchen"),
    ]

    # Category discount rates (e.g., 10% off electronics, 20% off apparel)
    discounts = {"Electronics": 0.10, "Apparel": 0.20}

    print("Initializing invoice generation...")

    # 💡 Execution stops here if you set a breakpoint at the start of main
    report = generate_invoice(catalog, discounts)

    print("\n--- Final Invoice Report ---")
    # 💡 Use 'pp report' here to see a beautifully formatted dictionary output
    print(f"Total Items: {report.items_processed}")
    print(f"Subtotal:   ${report.subtotal}")
    print(f"Total Due:  ${report.final_total}")
