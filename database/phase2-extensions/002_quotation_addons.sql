-- Enter-Flow Phase 2
-- Packaging and shipping snapshots for each quotation revision.
-- Review and authorize separately before database execution.

CREATE TABLE quotation_addon (
    quotation_addon_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quotation_id BIGINT UNSIGNED NOT NULL,
    addon_type ENUM('packaging','shipping') NOT NULL,
    raw_material_id BIGINT UNSIGNED NULL,
    label VARCHAR(200) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(19,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    include_in_unit_price BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY ix_quotation_addon_quotation (quotation_id, quotation_addon_id),
    KEY ix_quotation_addon_material (raw_material_id),
    CONSTRAINT fk_quotation_addon_quotation FOREIGN KEY (quotation_id)
        REFERENCES quotation(quotation_id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotation_addon_material FOREIGN KEY (raw_material_id)
        REFERENCES raw_material(material_id) ON DELETE RESTRICT,
    CONSTRAINT ck_quotation_addon_values CHECK (quantity > 0 AND unit_price >= 0),
    CONSTRAINT ck_quotation_addon_type_material CHECK (
        (addon_type = 'packaging' AND raw_material_id IS NOT NULL)
        OR (addon_type = 'shipping' AND raw_material_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
