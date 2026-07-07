# Deterministic SQLite fixture for the SQL-generation eval: a small retail
# schema (customers, products, orders, order_items) with hand-authored data
# so every eval run scores against identical ground truth.

import sqlite3
from pathlib import Path

FIXTURE_PATH = Path(__file__).parent / "fixture.db"

CUSTOMERS = [
    (1, "Aarav Shah", "Karachi", "2024-01-15"),
    (2, "Bina Patel", "Lahore", "2024-02-03"),
    (3, "Chen Wei", "Karachi", "2024-02-20"),
    (4, "Dana Khan", "Islamabad", "2024-03-11"),
    (5, "Elif Demir", "Lahore", "2024-03-28"),
    (6, "Farid Malik", "Karachi", "2024-04-09"),
    (7, "Grace Obi", "Islamabad", "2024-05-17"),
    (8, "Hamza Iqbal", "Lahore", "2024-06-02"),
]

PRODUCTS = [
    (1, "Laptop Pro", "Electronics", 1200.00),
    (2, "Wireless Mouse", "Electronics", 25.50),
    (3, "Office Chair", "Furniture", 180.00),
    (4, "Standing Desk", "Furniture", 420.00),
    (5, "Notebook Pack", "Stationery", 12.00),
    (6, "Fountain Pen", "Stationery", 45.00),
]

# (order_id, customer_id, order_date, status)
ORDERS = [
    (1, 1, "2024-03-05", "completed"),
    (2, 1, "2024-03-22", "completed"),
    (3, 2, "2024-03-30", "cancelled"),
    (4, 3, "2024-04-02", "completed"),
    (5, 3, "2024-04-15", "completed"),
    (6, 3, "2024-05-01", "completed"),
    (7, 4, "2024-04-20", "pending"),
    (8, 5, "2024-05-06", "completed"),
    (9, 5, "2024-05-19", "completed"),
    (10, 6, "2024-05-25", "cancelled"),
    (11, 6, "2024-06-08", "completed"),
    (12, 7, "2024-06-14", "completed"),
    (13, 8, "2024-06-21", "pending"),
    (14, 8, "2024-06-30", "completed"),
    (15, 2, "2024-07-04", "completed"),
]

# (order_item_id, order_id, product_id, quantity)
ORDER_ITEMS = [
    (1, 1, 1, 1), (2, 1, 2, 2),
    (3, 2, 5, 5),
    (4, 3, 3, 1),
    (5, 4, 4, 1), (6, 4, 2, 1),
    (7, 5, 6, 3),
    (8, 6, 1, 1), (9, 6, 5, 2),
    (10, 7, 3, 2),
    (11, 8, 2, 4),
    (12, 9, 4, 1), (13, 9, 6, 1),
    (14, 10, 5, 10),
    (15, 11, 1, 2),
    (16, 12, 3, 1), (17, 12, 5, 3),
    (18, 13, 6, 2),
    (19, 14, 2, 1), (20, 14, 4, 1),
    (21, 15, 5, 4),
]


def build_fixture(path: Path = FIXTURE_PATH) -> Path:
    """(Re)create the fixture DB. Idempotent — always rebuilds from scratch."""
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE customers (
                customer_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                signup_date TEXT NOT NULL
            );
            CREATE TABLE products (
                product_id INTEGER PRIMARY KEY,
                product_name TEXT NOT NULL,
                category TEXT NOT NULL,
                price REAL NOT NULL
            );
            CREATE TABLE orders (
                order_id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
                order_date TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE order_items (
                order_item_id INTEGER PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(order_id),
                product_id INTEGER NOT NULL REFERENCES products(product_id),
                quantity INTEGER NOT NULL
            );
            """
        )
        cur.executemany("INSERT INTO customers VALUES (?,?,?,?)", CUSTOMERS)
        cur.executemany("INSERT INTO products VALUES (?,?,?,?)", PRODUCTS)
        cur.executemany("INSERT INTO orders VALUES (?,?,?,?)", ORDERS)
        cur.executemany("INSERT INTO order_items VALUES (?,?,?,?)", ORDER_ITEMS)
        conn.commit()
    finally:
        conn.close()
    return path


COLUMN_DESCRIPTIONS = {
    "customers": {
        "customer_id": "primary key",
        "name": "customer full name",
        "city": "customer's city",
        "signup_date": "date the customer registered (YYYY-MM-DD)",
    },
    "products": {
        "product_id": "primary key",
        "product_name": "display name of the product",
        "category": "product category (Electronics, Furniture, Stationery)",
        "price": "unit price in USD",
    },
    "orders": {
        "order_id": "primary key",
        "customer_id": "references customers.customer_id",
        "order_date": "date the order was placed (YYYY-MM-DD)",
        "status": "completed, pending, or cancelled",
    },
    "order_items": {
        "order_item_id": "primary key",
        "order_id": "references orders.order_id",
        "product_id": "references products.product_id",
        "quantity": "units ordered",
    },
}
