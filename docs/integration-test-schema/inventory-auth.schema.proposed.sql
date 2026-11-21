-- PROPOSAL ONLY: reviewed initialization required; never execute against development.
-- Current-schema subset captured via allowlisted SHOW CREATE TABLE on MySQL 8.4.13.
-- No records, database creation, migration ledger, credentials or session settings.
-- Only table AUTO_INCREMENT counters removed; column AUTO_INCREMENT retained.

CREATE TABLE `roles` (
  `code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_terms` (
  `code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `days_after_receipt` smallint unsigned NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `material_categories` (
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `units` (
  `code` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `filter_types` (
  `code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_group` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city_province` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_term_code` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `joined_on` date DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_company` (`company_name`),
  KEY `payment_term_code` (`payment_term_code`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`payment_term_code`) REFERENCES `payment_terms` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned DEFAULT NULL,
  `account_type` enum('employee','client') COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_title` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `email_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `joined_on` date DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`),
  UNIQUE KEY `uq_user_username` (`username`),
  UNIQUE KEY `uq_employee_number` (`employee_number`),
  UNIQUE KEY `uq_user_client_account` (`client_id`),
  KEY `role_code` (`role_code`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_code`) REFERENCES `roles` (`code`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `ck_user_identity` CHECK ((((`account_type` = _utf8mb4'client') and (`role_code` = _utf8mb4'client') and (`client_id` is not null) and (`employee_number` is null)) or ((`account_type` = _utf8mb4'employee') and (`role_code` <> _utf8mb4'client') and (`client_id` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_activity_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`),
  KEY `ix_user_sessions_user_id` (`user_id`),
  KEY `ix_user_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_specifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` bigint unsigned NOT NULL,
  `filter_type_code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filter_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `od1` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `od2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id1` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `height` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `overall_height` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `length` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `width` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thickness` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `depth` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pocket_count` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `diameter` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cloth_cutting_width` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cloth_cutting_length` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spring_plate_center_to_center` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spring_plate_width` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spring_plate_length` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pad_od` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pad_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `media` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inner_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outer_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gasket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_cap` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oem_part_number` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filtration_rating` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `others` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_spec_client` (`id`,`client_id`),
  KEY `client_id` (`client_id`),
  KEY `filter_type_code` (`filter_type_code`),
  CONSTRAINT `product_specifications_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `product_specifications_ibfk_2` FOREIGN KEY (`filter_type_code`) REFERENCES `filter_types` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `materials` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_code` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_code` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_unit` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `unit_price` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `reference_unit_price` decimal(15,4) DEFAULT NULL,
  `reference_price_text` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_price_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_price_source_sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `reference_price_page` smallint unsigned DEFAULT NULL,
  `reference_price_row` smallint unsigned DEFAULT NULL,
  `reference_price_status` enum('unreviewed','needs_review','reviewed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unreviewed',
  `approved_costing_price` decimal(15,4) DEFAULT NULL,
  `costing_price_approved_by` bigint unsigned DEFAULT NULL,
  `costing_price_approved_at` datetime(3) DEFAULT NULL,
  `quantity_on_hand` decimal(15,4) DEFAULT NULL,
  `quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `reorder_threshold` decimal(15,4) DEFAULT NULL,
  `threshold_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `supplier_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_material_item_code` (`item_code`),
  UNIQUE KEY `uq_material_source_row` (`reference_price_source_sha256`,`reference_price_page`,`reference_price_row`),
  KEY `ix_material_category` (`category_code`,`name`),
  KEY `unit_code` (`unit_code`),
  KEY `fk_material_costing_price_approver` (`costing_price_approved_by`),
  CONSTRAINT `fk_material_costing_price_approver` FOREIGN KEY (`costing_price_approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `materials_ibfk_1` FOREIGN KEY (`category_code`) REFERENCES `material_categories` (`code`),
  CONSTRAINT `materials_ibfk_2` FOREIGN KEY (`unit_code`) REFERENCES `units` (`code`),
  CONSTRAINT `ck_material_stock_provenance` CHECK (((((`quantity_on_hand` is null) and (`quantity_status` = _utf8mb4'unknown')) or ((`quantity_on_hand` is not null) and (`quantity_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')))) and (((`reorder_threshold` is null) and (`threshold_status` = _utf8mb4'unknown')) or ((`reorder_threshold` is not null) and (`threshold_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')))))),
  CONSTRAINT `ck_material_values` CHECK (((`unit_price` >= 0) and ((`reference_unit_price` is null) or (`reference_unit_price` >= 0)) and ((`approved_costing_price` is null) or (`approved_costing_price` >= 0)) and ((`quantity_on_hand` is null) or (`quantity_on_hand` >= 0)) and ((`reorder_threshold` is null) or (`reorder_threshold` >= 0)) and (((`approved_costing_price` is null) and (`costing_price_approved_by` is null) and (`costing_price_approved_at` is null)) or ((`approved_costing_price` is not null) and (`costing_price_approved_by` is not null) and (`costing_price_approved_at` is not null)))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `finished_goods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` bigint unsigned NOT NULL,
  `item_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enterfil_part_number` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specification_id` bigint unsigned NOT NULL,
  `quantity_on_hand` int unsigned NOT NULL DEFAULT '0',
  `buffer_minimum` int unsigned NOT NULL DEFAULT '0',
  `demand` enum('HIGH DEMAND','MONITOR','STABLE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STABLE',
  `updated_by` bigint unsigned NOT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finished_item_code` (`item_code`),
  UNIQUE KEY `uq_finished_client_pair` (`id`,`client_id`),
  KEY `ix_finished_client_part` (`client_id`,`enterfil_part_number`),
  KEY `specification_id` (`specification_id`,`client_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `finished_goods_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `finished_goods_ibfk_2` FOREIGN KEY (`specification_id`, `client_id`) REFERENCES `product_specifications` (`id`, `client_id`),
  CONSTRAINT `finished_goods_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
