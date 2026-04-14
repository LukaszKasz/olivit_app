from pathlib import Path


def load_variant_products_seed() -> list[tuple[str, str, str]]:
    seed_path = Path(__file__).with_name("variant_products_seed.tsv")
    rows: list[tuple[str, str, str]] = []

    for raw_line in seed_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        parts = [part.strip() for part in raw_line.split("\t")]
        parts = [part for part in parts if part]
        if len(parts) < 3:
            continue

        sku = parts[0]
        ean = parts[-1]
        name = " ".join(parts[1:-1]).strip()
        rows.append((sku, name, ean))

    return rows
