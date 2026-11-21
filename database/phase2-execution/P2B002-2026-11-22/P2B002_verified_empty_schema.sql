-- MySQL dump 10.13  Distrib 8.4.13, for Linux (x86_64)
--
-- Host: localhost    Database: enterflow_phase2_db
-- ------------------------------------------------------
-- Server version	8.4.13

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_event`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_event` (
  `audit_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_user_id` bigint unsigned DEFAULT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` bigint unsigned NOT NULL,
  `before_value` json DEFAULT NULL,
  `after_value` json DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `occurred_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`audit_event_id`),
  KEY `ix_audit_subject` (`subject_type`,`subject_id`,`occurred_at`),
  KEY `actor_user_id` (`actor_user_id`),
  CONSTRAINT `audit_event_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_event`
--

LOCK TABLES `audit_event` WRITE;
/*!40000 ALTER TABLE `audit_event` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_event` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `audit_event_append_only_update` BEFORE UPDATE ON `audit_event` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `audit_event_append_only_delete` BEFORE DELETE ON `audit_event` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `client`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client` (
  `client_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city_province` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zip_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferred_delivery_method_id` bigint unsigned DEFAULT NULL,
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_since` date DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `uq_client_company` (`company_name`),
  KEY `preferred_delivery_method_id` (`preferred_delivery_method_id`),
  CONSTRAINT `client_ibfk_1` FOREIGN KEY (`preferred_delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client`
--

LOCK TABLES `client` WRITE;
/*!40000 ALTER TABLE `client` DISABLE KEYS */;
/*!40000 ALTER TABLE `client` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_receipt`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_receipt` (
  `receipt_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `client_user_id` bigint unsigned NOT NULL,
  `payment_method_id` bigint unsigned NOT NULL,
  `amount_declared` decimal(19,2) NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `review_status` enum('pending','verified','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` bigint unsigned DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `review_note` text COLLATE utf8mb4_unicode_ci,
  `sent_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uq_receipt_invoice` (`receipt_id`,`invoice_id`),
  KEY `ix_receipt_review` (`review_status`,`sent_at`),
  KEY `invoice_id` (`invoice_id`),
  KEY `client_user_id` (`client_user_id`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `reviewed_by_user_id` (`reviewed_by_user_id`),
  CONSTRAINT `client_receipt_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoice` (`invoice_id`),
  CONSTRAINT `client_receipt_ibfk_2` FOREIGN KEY (`client_user_id`) REFERENCES `client_user` (`client_user_id`),
  CONSTRAINT `client_receipt_ibfk_3` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`),
  CONSTRAINT `client_receipt_ibfk_4` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_receipt_amount` CHECK ((`amount_declared` > 0)),
  CONSTRAINT `ck_receipt_review` CHECK ((((`review_status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`review_status` in (_utf8mb4'verified',_utf8mb4'rejected')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_receipt`
--

LOCK TABLES `client_receipt` WRITE;
/*!40000 ALTER TABLE `client_receipt` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_receipt` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `receipt_client_owner_bi` BEFORE INSERT ON `client_receipt` FOR EACH ROW BEGIN
IF (SELECT i.client_id FROM sales_invoice s JOIN purchase_order p ON p.po_id=s.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE s.invoice_id=NEW.invoice_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Receipt submitter must own the invoice client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `receipt_client_owner_bu` BEFORE UPDATE ON `client_receipt` FOR EACH ROW BEGIN
IF (SELECT i.client_id FROM sales_invoice s JOIN purchase_order p ON p.po_id=s.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE s.invoice_id=NEW.invoice_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Receipt submitter must own the invoice client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `client_receipt_file`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_receipt_file` (
  `receipt_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`receipt_id`,`document_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `client_receipt_file_ibfk_1` FOREIGN KEY (`receipt_id`) REFERENCES `client_receipt` (`receipt_id`),
  CONSTRAINT `client_receipt_file_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_receipt_file`
--

LOCK TABLES `client_receipt_file` WRITE;
/*!40000 ALTER TABLE `client_receipt_file` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_receipt_file` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_user`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_user` (
  `client_user_id` bigint unsigned NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`client_user_id`),
  UNIQUE KEY `uq_company_portal_login` (`client_id`),
  UNIQUE KEY `uq_client_user_owner` (`client_user_id`,`client_id`),
  CONSTRAINT `client_user_ibfk_1` FOREIGN KEY (`client_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `client_user_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_user`
--

LOCK TABLES `client_user` WRITE;
/*!40000 ALTER TABLE `client_user` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_user` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `client_user_role_bi` BEFORE INSERT ON `client_user` FOR EACH ROW BEGIN
IF (SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.client_user_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal profile requires Client role'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `client_user_role_bu` BEFORE UPDATE ON `client_user` FOR EACH ROW BEGIN
IF (SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.client_user_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal profile requires Client role'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `client_user_client_id_history` BEFORE UPDATE ON `client_user` FOR EACH ROW BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM client_receipt WHERE client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM inquiry WHERE submitted_by_client_user_id=OLD.client_user_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `cost_estimate`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cost_estimate` (
  `estimate_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_item_id` bigint unsigned NOT NULL,
  `labor_cost_per_unit` decimal(15,4) NOT NULL,
  `include_labor` tinyint(1) NOT NULL,
  `markup_percent` decimal(9,4) NOT NULL,
  `apply_markup` tinyint(1) NOT NULL,
  `vat_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vat_rate` decimal(7,4) NOT NULL,
  `apply_vat` tinyint(1) NOT NULL,
  `material_cost_per_unit` decimal(15,4) NOT NULL,
  `unit_cost_with_markup` decimal(15,4) NOT NULL,
  `unit_cost_with_vat` decimal(15,4) NOT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `created_by_user_id` bigint unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`estimate_id`),
  KEY `ix_estimate_item_history` (`quotation_item_id`,`created_at`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `cost_estimate_ibfk_1` FOREIGN KEY (`quotation_item_id`) REFERENCES `quotation_item` (`quotation_item_id`),
  CONSTRAINT `cost_estimate_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_estimate_flags` CHECK (((`include_labor` in (0,1)) and (`apply_markup` in (0,1)) and (`apply_vat` in (0,1)) and (`is_locked` in (0,1)))),
  CONSTRAINT `ck_estimate_values` CHECK (((`labor_cost_per_unit` >= 0) and (`markup_percent` >= 0) and (`vat_rate` between 0 and 100) and (`material_cost_per_unit` >= 0) and (`unit_cost_with_markup` >= 0) and (`unit_cost_with_vat` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cost_estimate`
--

LOCK TABLES `cost_estimate` WRITE;
/*!40000 ALTER TABLE `cost_estimate` DISABLE KEYS */;
/*!40000 ALTER TABLE `cost_estimate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cost_estimate_material`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cost_estimate_material` (
  `estimate_material_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `estimate_id` bigint unsigned NOT NULL,
  `material_category_id` bigint unsigned DEFAULT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_per_filter` decimal(15,4) NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `unit_price_snapshot` decimal(15,4) NOT NULL,
  `line_cost` decimal(19,4) GENERATED ALWAYS AS ((`qty_per_filter` * `unit_price_snapshot`)) STORED,
  PRIMARY KEY (`estimate_material_id`),
  KEY `estimate_id` (`estimate_id`),
  KEY `material_category_id` (`material_category_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `uom_id` (`uom_id`),
  CONSTRAINT `cost_estimate_material_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `cost_estimate` (`estimate_id`),
  CONSTRAINT `cost_estimate_material_ibfk_2` FOREIGN KEY (`material_category_id`) REFERENCES `material_category` (`material_category_id`),
  CONSTRAINT `cost_estimate_material_ibfk_3` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `cost_estimate_material_ibfk_4` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `ck_estimate_material_values` CHECK (((`qty_per_filter` > 0) and (`unit_price_snapshot` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cost_estimate_material`
--

LOCK TABLES `cost_estimate_material` WRITE;
/*!40000 ALTER TABLE `cost_estimate_material` DISABLE KEYS */;
/*!40000 ALTER TABLE `cost_estimate_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery` (
  `delivery_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dispatch_date` datetime(3) DEFAULT NULL,
  `estimated_delivery_date` date DEFAULT NULL,
  `delivered_date` datetime(3) DEFAULT NULL,
  `driver_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_contact` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_plate` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_link` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_by` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `dispatched_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`delivery_id`),
  KEY `ix_delivery_queue` (`status`,`estimated_delivery_date`),
  KEY `jo_id` (`jo_id`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `dispatched_by_user_id` (`dispatched_by_user_id`),
  CONSTRAINT `delivery_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `delivery_ibfk_2` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `delivery_ibfk_3` FOREIGN KEY (`dispatched_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery`
--

LOCK TABLES `delivery` WRITE;
/*!40000 ALTER TABLE `delivery` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `delivery_jo_id_history` BEFORE UPDATE ON `delivery` FOR EACH ROW BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM delivery_item WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM waybill WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM delivery_receipt WHERE delivery_id=OLD.delivery_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `delivery_item`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_item` (
  `delivery_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `jo_item_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  PRIMARY KEY (`delivery_item_id`),
  UNIQUE KEY `uq_delivery_item` (`delivery_id`,`jo_item_id`),
  KEY `jo_item_id` (`jo_item_id`),
  CONSTRAINT `delivery_item_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `delivery_item_ibfk_2` FOREIGN KEY (`jo_item_id`) REFERENCES `job_order_item` (`jo_item_id`),
  CONSTRAINT `ck_delivery_item_quantity` CHECK ((`quantity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_item`
--

LOCK TABLES `delivery_item` WRITE;
/*!40000 ALTER TABLE `delivery_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_item` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `delivery_item_owner_bi` BEFORE INSERT ON `delivery_item` FOR EACH ROW BEGIN
IF (SELECT jo_id FROM delivery WHERE delivery_id=NEW.delivery_id)<>(SELECT jo_id FROM job_order_item WHERE jo_item_id=NEW.jo_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Delivery item must belong to the same JO'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `delivery_item_owner_bu` BEFORE UPDATE ON `delivery_item` FOR EACH ROW BEGIN
IF (SELECT jo_id FROM delivery WHERE delivery_id=NEW.delivery_id)<>(SELECT jo_id FROM job_order_item WHERE jo_item_id=NEW.jo_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Delivery item must belong to the same JO'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `delivery_method`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_method` (
  `delivery_method_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `method_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`delivery_method_id`),
  UNIQUE KEY `uq_delivery_method_name` (`method_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_method`
--

LOCK TABLES `delivery_method` WRITE;
/*!40000 ALTER TABLE `delivery_method` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_method` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_receipt`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_receipt` (
  `delivery_receipt_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `dr_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generated_by_user_id` bigint unsigned NOT NULL,
  `generated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`delivery_receipt_id`),
  UNIQUE KEY `uq_dr_delivery` (`delivery_id`),
  UNIQUE KEY `uq_dr_number` (`dr_no`),
  KEY `generated_by_user_id` (`generated_by_user_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `delivery_receipt_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `delivery_receipt_ibfk_2` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `delivery_receipt_ibfk_3` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_receipt`
--

LOCK TABLES `delivery_receipt` WRITE;
/*!40000 ALTER TABLE `delivery_receipt` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_receipt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document` (
  `document_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_bucket` varchar(63) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `storage_key` varchar(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `object_generation` varchar(40) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `storage_status` enum('pending','available','failed','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `uploaded_by_user_id` bigint unsigned NOT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`document_id`),
  UNIQUE KEY `uq_document_object_version` (`storage_bucket`,`storage_key`,`object_generation`),
  KEY `uploaded_by_user_id` (`uploaded_by_user_id`),
  CONSTRAINT `document_ibfk_1` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_document_available` CHECK (((`storage_status` <> _utf8mb4'available') or ((`storage_bucket` is not null) and (`storage_key` is not null) and (`object_generation` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document`
--

LOCK TABLES `document` WRITE;
/*!40000 ALTER TABLE `document` DISABLE KEYS */;
/*!40000 ALTER TABLE `document` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `filter_type`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `filter_type` (
  `filter_type_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `filter_type_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_group` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`filter_type_id`),
  UNIQUE KEY `uq_filter_type_name` (`filter_type_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `filter_type`
--

LOCK TABLES `filter_type` WRITE;
/*!40000 ALTER TABLE `filter_type` DISABLE KEYS */;
/*!40000 ALTER TABLE `filter_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finished_good`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finished_good` (
  `finished_good_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enterfil_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `filter_type_id` bigint unsigned NOT NULL,
  `qty_in_stock` int unsigned DEFAULT NULL,
  `quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `buffer_min` int unsigned DEFAULT NULL,
  `threshold_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `demand_level` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_frequency` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avg_qty_per_order` decimal(15,4) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`finished_good_id`),
  UNIQUE KEY `uq_finished_item_code` (`item_code`),
  KEY `ix_finished_client` (`client_id`,`item_name`),
  KEY `filter_type_id` (`filter_type_id`),
  CONSTRAINT `finished_good_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `finished_good_ibfk_2` FOREIGN KEY (`filter_type_id`) REFERENCES `filter_type` (`filter_type_id`),
  CONSTRAINT `ck_finished_average` CHECK (((`avg_qty_per_order` is null) or (`avg_qty_per_order` >= 0))),
  CONSTRAINT `ck_finished_quantity` CHECK ((((`quantity_status` = _utf8mb4'unknown') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`qty_in_stock` is not null)))),
  CONSTRAINT `ck_finished_threshold` CHECK ((((`threshold_status` = _utf8mb4'unknown') and (`buffer_min` is null)) or ((`threshold_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`buffer_min` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finished_good`
--

LOCK TABLES `finished_good` WRITE;
/*!40000 ALTER TABLE `finished_good` DISABLE KEYS */;
/*!40000 ALTER TABLE `finished_good` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `finished_good_client_id_history` BEFORE UPDATE ON `finished_good` FOR EACH ROW BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM production_plan WHERE finished_good_id=OLD.finished_good_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE finished_good_id=OLD.finished_good_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `inquiry`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inquiry` (
  `inquiry_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_by_client_user_id` bigint unsigned DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `general_notes` text COLLATE utf8mb4_unicode_ci,
  `required_by_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`inquiry_id`),
  UNIQUE KEY `uq_inquiry_number` (`inquiry_no`),
  KEY `ix_inquiry_client_queue` (`client_id`,`status`,`created_at`),
  KEY `submitted_by_client_user_id` (`submitted_by_client_user_id`,`client_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `inquiry_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `inquiry_ibfk_2` FOREIGN KEY (`submitted_by_client_user_id`, `client_id`) REFERENCES `client_user` (`client_user_id`, `client_id`),
  CONSTRAINT `inquiry_ibfk_3` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_inquiry_creator` CHECK (((`submitted_by_client_user_id` is not null) or (`created_by_user_id` is not null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inquiry`
--

LOCK TABLES `inquiry` WRITE;
/*!40000 ALTER TABLE `inquiry` DISABLE KEYS */;
/*!40000 ALTER TABLE `inquiry` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `inquiry_client_id_history` BEFORE UPDATE ON `inquiry` FOR EACH ROW BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM quotation WHERE inquiry_id=OLD.inquiry_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `inquiry_item`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inquiry_item` (
  `inquiry_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_id` bigint unsigned NOT NULL,
  `line_no` smallint unsigned NOT NULL,
  `filter_type_id` bigint unsigned NOT NULL,
  `filter_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oem_reference` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `od1_mm` decimal(15,4) DEFAULT NULL,
  `od2_mm` decimal(15,4) DEFAULT NULL,
  `id1_mm` decimal(15,4) DEFAULT NULL,
  `id2_mm` decimal(15,4) DEFAULT NULL,
  `height_mm` decimal(15,4) DEFAULT NULL,
  `overall_height_mm` decimal(15,4) DEFAULT NULL,
  `filter_media` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inner_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outer_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `o_ring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gasket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filtration_rating` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filtration_rating_custom` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int unsigned NOT NULL,
  `template_specifications` json DEFAULT NULL,
  `sketch_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`inquiry_item_id`),
  UNIQUE KEY `uq_inquiry_line` (`inquiry_id`,`line_no`),
  KEY `filter_type_id` (`filter_type_id`),
  KEY `sketch_document_id` (`sketch_document_id`),
  CONSTRAINT `inquiry_item_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `inquiry_item_ibfk_2` FOREIGN KEY (`filter_type_id`) REFERENCES `filter_type` (`filter_type_id`),
  CONSTRAINT `inquiry_item_ibfk_3` FOREIGN KEY (`sketch_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_inquiry_line_quantity` CHECK (((`quantity` > 0) and (`line_no` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inquiry_item`
--

LOCK TABLES `inquiry_item` WRITE;
/*!40000 ALTER TABLE `inquiry_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `inquiry_item` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `inquiry_item_inquiry_id_history` BEFORE UPDATE ON `inquiry_item` FOR EACH ROW BEGIN
IF NOT(NEW.inquiry_id<=>OLD.inquiry_id) AND (EXISTS(SELECT 1 FROM quotation_item WHERE inquiry_item_id=OLD.inquiry_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `job_order`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_order` (
  `jo_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_id` bigint unsigned NOT NULL,
  `jo_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `po_verified` tinyint(1) NOT NULL DEFAULT '0',
  `specs_verified` tinyint(1) NOT NULL DEFAULT '0',
  `terms_verified` tinyint(1) NOT NULL DEFAULT '0',
  `prepared_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `completed_at` datetime(3) DEFAULT NULL,
  `archived_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`jo_id`),
  UNIQUE KEY `uq_jo_number` (`jo_no`),
  UNIQUE KEY `uq_jo_po` (`po_id`),
  KEY `ix_jo_queue` (`status`,`due_date`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `prepared_by_user_id` (`prepared_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  CONSTRAINT `job_order_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_order` (`po_id`),
  CONSTRAINT `job_order_ibfk_2` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `job_order_ibfk_3` FOREIGN KEY (`prepared_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `job_order_ibfk_4` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_jo_verification_flags` CHECK (((`po_verified` in (0,1)) and (`specs_verified` in (0,1)) and (`terms_verified` in (0,1))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_order`
--

LOCK TABLES `job_order` WRITE;
/*!40000 ALTER TABLE `job_order` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `job_order_po_id_history` BEFORE UPDATE ON `job_order` FOR EACH ROW BEGIN
IF NOT(NEW.po_id<=>OLD.po_id) AND (EXISTS(SELECT 1 FROM job_order_item WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM delivery WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM production_plan WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM job_order_stage WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_id=OLD.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `job_order_item`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_order_item` (
  `jo_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `quotation_item_id` bigint unsigned NOT NULL,
  `line_no` smallint unsigned NOT NULL,
  `item_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enterfil_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int unsigned NOT NULL,
  `od1_mm` decimal(15,4) DEFAULT NULL,
  `od2_mm` decimal(15,4) DEFAULT NULL,
  `id1_mm` decimal(15,4) DEFAULT NULL,
  `id2_mm` decimal(15,4) DEFAULT NULL,
  `height_mm` decimal(15,4) DEFAULT NULL,
  `overall_height_mm` decimal(15,4) DEFAULT NULL,
  `filter_media` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inner_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outer_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_cap` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `o_ring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gasket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oem_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `other_specs` text COLLATE utf8mb4_unicode_ci,
  `template_specifications_snapshot` json DEFAULT NULL,
  `final_sketch_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`jo_item_id`),
  UNIQUE KEY `uq_jo_item_line` (`jo_id`,`line_no`),
  KEY `quotation_item_id` (`quotation_item_id`),
  KEY `final_sketch_document_id` (`final_sketch_document_id`),
  CONSTRAINT `job_order_item_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `job_order_item_ibfk_2` FOREIGN KEY (`quotation_item_id`) REFERENCES `quotation_item` (`quotation_item_id`),
  CONSTRAINT `job_order_item_ibfk_3` FOREIGN KEY (`final_sketch_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_jo_item_quantity` CHECK (((`quantity` > 0) and (`line_no` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_order_item`
--

LOCK TABLES `job_order_item` WRITE;
/*!40000 ALTER TABLE `job_order_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_order_item` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `jo_item_source_bi` BEFORE INSERT ON `job_order_item` FOR EACH ROW BEGIN
IF (SELECT p.quotation_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id WHERE j.jo_id=NEW.jo_id)<>(SELECT quotation_id FROM quotation_item WHERE quotation_item_id=NEW.quotation_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JO item must reference its PO accepted quotation'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `jo_item_source_bu` BEFORE UPDATE ON `job_order_item` FOR EACH ROW BEGIN
IF (SELECT p.quotation_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id WHERE j.jo_id=NEW.jo_id)<>(SELECT quotation_id FROM quotation_item WHERE quotation_item_id=NEW.quotation_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JO item must reference its PO accepted quotation'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `job_order_item_jo_id_history` BEFORE UPDATE ON `job_order_item` FOR EACH ROW BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM delivery_item WHERE jo_item_id=OLD.jo_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `job_order_stage`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_order_stage` (
  `jo_stage_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `stage_id` bigint unsigned NOT NULL,
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `started_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  `marked_by_user_id` bigint unsigned DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `reverted_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`jo_stage_id`),
  UNIQUE KEY `uq_jo_defined_stage` (`jo_id`,`stage_id`),
  KEY `stage_id` (`stage_id`),
  KEY `marked_by_user_id` (`marked_by_user_id`),
  CONSTRAINT `job_order_stage_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `job_order_stage_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stage` (`stage_id`),
  CONSTRAINT `job_order_stage_ibfk_3` FOREIGN KEY (`marked_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_stage_times` CHECK ((((`status` = _utf8mb4'pending') and (`started_at` is null) and (`completed_at` is null)) or ((`status` = _utf8mb4'in_progress') and (`started_at` is not null) and (`completed_at` is null) and (`marked_by_user_id` is not null)) or ((`status` = _utf8mb4'completed') and (`started_at` is not null) and (`completed_at` is not null) and (`completed_at` >= `started_at`) and (`marked_by_user_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_order_stage`
--

LOCK TABLES `job_order_stage` WRITE;
/*!40000 ALTER TABLE `job_order_stage` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_order_stage` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `job_order_stage_jo_id_history` BEFORE UPDATE ON `job_order_stage` FOR EACH ROW BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_stage_id=OLD.jo_stage_id) OR EXISTS(SELECT 1 FROM production_stage_event WHERE jo_stage_id=OLD.jo_stage_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `material_category`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_category` (
  `material_category_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`material_category_id`),
  UNIQUE KEY `uq_material_category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_category`
--

LOCK TABLES `material_category` WRITE;
/*!40000 ALTER TABLE `material_category` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_shortage_report`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_shortage_report` (
  `report_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `jo_stage_id` bigint unsigned DEFAULT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_needed` decimal(15,4) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reported_by_user_id` bigint unsigned NOT NULL,
  `reported_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolved_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  KEY `ix_shortage_queue` (`status`,`reported_at`),
  KEY `jo_id` (`jo_id`),
  KEY `jo_stage_id` (`jo_stage_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `reported_by_user_id` (`reported_by_user_id`),
  CONSTRAINT `material_shortage_report_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `material_shortage_report_ibfk_2` FOREIGN KEY (`jo_stage_id`) REFERENCES `job_order_stage` (`jo_stage_id`),
  CONSTRAINT `material_shortage_report_ibfk_3` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `material_shortage_report_ibfk_4` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_shortage_quantity` CHECK ((`qty_needed` > 0)),
  CONSTRAINT `ck_shortage_resolved` CHECK (((`resolved_at` is null) or (`resolved_at` >= `reported_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_shortage_report`
--

LOCK TABLES `material_shortage_report` WRITE;
/*!40000 ALTER TABLE `material_shortage_report` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_shortage_report` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `shortage_stage_owner_bi` BEFORE INSERT ON `material_shortage_report` FOR EACH ROW BEGIN
IF NEW.jo_stage_id IS NOT NULL AND NEW.jo_id<>(SELECT jo_id FROM job_order_stage WHERE jo_stage_id=NEW.jo_stage_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Shortage stage must belong to its JO'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `shortage_stage_owner_bu` BEFORE UPDATE ON `material_shortage_report` FOR EACH ROW BEGIN
IF NEW.jo_stage_id IS NOT NULL AND NEW.jo_id<>(SELECT jo_id FROM job_order_stage WHERE jo_stage_id=NEW.jo_stage_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Shortage stage must belong to its JO'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `notification`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification` (
  `notification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `ix_user_notifications` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_notification_read` CHECK ((((`is_read` = 0) and (`read_at` is null)) or ((`is_read` = 1) and (`read_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification`
--

LOCK TABLES `notification` WRITE;
/*!40000 ALTER TABLE `notification` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_method`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_method` (
  `payment_method_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `method_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`payment_method_id`),
  UNIQUE KEY `uq_payment_method_name` (`method_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_method`
--

LOCK TABLES `payment_method` WRITE;
/*!40000 ALTER TABLE `payment_method` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_method` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_transaction`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transaction` (
  `payment_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `payment_method_id` bigint unsigned NOT NULL,
  `transaction_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(19,2) NOT NULL,
  `reference_no` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_paid` date NOT NULL,
  `client_receipt_id` bigint unsigned DEFAULT NULL,
  `approval_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `recorded_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned NOT NULL,
  `approved_at` datetime(3) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `operation_key` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `official_receipt_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_payment_operation` (`operation_key`),
  KEY `ix_invoice_payments` (`invoice_id`,`date_paid`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `client_receipt_id` (`client_receipt_id`,`invoice_id`),
  KEY `recorded_by_user_id` (`recorded_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  KEY `official_receipt_document_id` (`official_receipt_document_id`),
  CONSTRAINT `payment_transaction_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoice` (`invoice_id`),
  CONSTRAINT `payment_transaction_ibfk_2` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`),
  CONSTRAINT `payment_transaction_ibfk_3` FOREIGN KEY (`client_receipt_id`, `invoice_id`) REFERENCES `client_receipt` (`receipt_id`, `invoice_id`),
  CONSTRAINT `payment_transaction_ibfk_4` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `payment_transaction_ibfk_5` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `payment_transaction_ibfk_6` FOREIGN KEY (`official_receipt_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_confirmed_payment` CHECK (((`amount` > 0) and (`approval_status` = _utf8mb4'approved')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_transaction`
--

LOCK TABLES `payment_transaction` WRITE;
/*!40000 ALTER TABLE `payment_transaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_plan`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_plan` (
  `plan_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `finished_good_id` bigint unsigned DEFAULT NULL,
  `jo_id` bigint unsigned DEFAULT NULL,
  `source` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planned_qty` int unsigned NOT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `created_by_user_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`plan_id`),
  UNIQUE KEY `uq_plan_code` (`plan_code`),
  KEY `client_id` (`client_id`),
  KEY `finished_good_id` (`finished_good_id`),
  KEY `jo_id` (`jo_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `production_plan_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `production_plan_ibfk_2` FOREIGN KEY (`finished_good_id`) REFERENCES `finished_good` (`finished_good_id`),
  CONSTRAINT `production_plan_ibfk_3` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `production_plan_ibfk_4` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_production_plan` CHECK (((`planned_qty` > 0) and (`week_end_date` >= `week_start_date`) and ((`finished_good_id` is not null) or (`jo_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_plan` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `plan_client_owner_bi` BEFORE INSERT ON `production_plan` FOR EACH ROW BEGIN
IF (NEW.finished_good_id IS NOT NULL AND NEW.client_id<>(SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)) OR (NEW.jo_id IS NOT NULL AND NEW.client_id<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Production plan sources must belong to its client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `plan_client_owner_bu` BEFORE UPDATE ON `production_plan` FOR EACH ROW BEGIN
IF (NEW.finished_good_id IS NOT NULL AND NEW.client_id<>(SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)) OR (NEW.jo_id IS NOT NULL AND NEW.client_id<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Production plan sources must belong to its client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `production_stage`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_stage` (
  `stage_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_order` smallint unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`stage_id`),
  UNIQUE KEY `uq_stage_name` (`stage_name`),
  UNIQUE KEY `uq_stage_order` (`stage_order`),
  CONSTRAINT `ck_ten_stage_positions` CHECK ((`stage_order` between 1 and 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_stage`
--

LOCK TABLES `production_stage` WRITE;
/*!40000 ALTER TABLE `production_stage` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_stage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_stage_event`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_stage_event` (
  `stage_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_stage_id` bigint unsigned NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `performed_by_user_id` bigint unsigned NOT NULL,
  `occurred_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`stage_event_id`),
  KEY `ix_stage_event_history` (`jo_stage_id`,`occurred_at`,`stage_event_id`),
  KEY `performed_by_user_id` (`performed_by_user_id`),
  CONSTRAINT `production_stage_event_ibfk_1` FOREIGN KEY (`jo_stage_id`) REFERENCES `job_order_stage` (`jo_stage_id`),
  CONSTRAINT `production_stage_event_ibfk_2` FOREIGN KEY (`performed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_stage_reversion_reason` CHECK (((`action` <> _utf8mb4'reverted') or ((`reason` is not null) and (char_length(trim(`reason`)) > 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_stage_event`
--

LOCK TABLES `production_stage_event` WRITE;
/*!40000 ALTER TABLE `production_stage_event` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_stage_event` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `production_stage_event_append_only_update` BEFORE UPDATE ON `production_stage_event` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `production_stage_event_append_only_delete` BEFORE DELETE ON `production_stage_event` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `purchase_order`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order` (
  `po_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `po_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotation_id` bigint unsigned NOT NULL,
  `po_document_id` bigint unsigned NOT NULL,
  `received_date` date NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `recorded_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`po_id`),
  UNIQUE KEY `uq_po_number` (`po_no`),
  KEY `quotation_id` (`quotation_id`),
  KEY `po_document_id` (`po_document_id`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `recorded_by_user_id` (`recorded_by_user_id`),
  CONSTRAINT `purchase_order_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotation` (`quotation_id`),
  CONSTRAINT `purchase_order_ibfk_2` FOREIGN KEY (`po_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `purchase_order_ibfk_3` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `purchase_order_ibfk_4` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order`
--

LOCK TABLES `purchase_order` WRITE;
/*!40000 ALTER TABLE `purchase_order` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `purchase_order_quotation_id_history` BEFORE UPDATE ON `purchase_order` FOR EACH ROW BEGIN
IF NOT(NEW.quotation_id<=>OLD.quotation_id) AND (EXISTS(SELECT 1 FROM job_order WHERE po_id=OLD.po_id) OR EXISTS(SELECT 1 FROM sales_invoice WHERE po_id=OLD.po_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `quotation`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation` (
  `quotation_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inquiry_id` bigint unsigned NOT NULL,
  `revision_no` smallint unsigned NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '1',
  `current_inquiry_id` bigint unsigned GENERATED ALWAYS AS ((case when (`is_current` = 1) then `inquiry_id` else NULL end)) STORED,
  `quotation_date` date NOT NULL,
  `valid_until` date NOT NULL,
  `terms_of_payment` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time_of_delivery` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `place_of_delivery` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `vat_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `highlight_tag` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `highlight_note` text COLLATE utf8mb4_unicode_ci,
  `requires_downpayment` tinyint(1) NOT NULL DEFAULT '1',
  `downpayment_percent` decimal(5,2) NOT NULL,
  `downpayment_amount` decimal(19,2) NOT NULL,
  `subtotal` decimal(19,2) NOT NULL,
  `addons_total` decimal(19,2) NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prepared_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned DEFAULT NULL,
  `sent_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`quotation_id`),
  UNIQUE KEY `uq_quotation_number` (`quotation_no`),
  UNIQUE KEY `uq_quotation_revision` (`inquiry_id`,`revision_no`),
  UNIQUE KEY `uq_current_quotation` (`current_inquiry_id`),
  KEY `prepared_by_user_id` (`prepared_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  CONSTRAINT `quotation_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `quotation_ibfk_2` FOREIGN KEY (`prepared_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `quotation_ibfk_3` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_quotation_current` CHECK ((`is_current` in (0,1))),
  CONSTRAINT `ck_quotation_dates` CHECK ((`valid_until` >= `quotation_date`)),
  CONSTRAINT `ck_quotation_money` CHECK (((`subtotal` >= 0) and (`addons_total` >= 0) and (`total_amount` >= 0) and (`requires_downpayment` = 1) and (`downpayment_percent` in (20,50)) and (`downpayment_amount` = round(((`total_amount` * `downpayment_percent`) / 100),2))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation`
--

LOCK TABLES `quotation` WRITE;
/*!40000 ALTER TABLE `quotation` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `quotation_inquiry_id_history` BEFORE UPDATE ON `quotation` FOR EACH ROW BEGIN
IF NOT(NEW.inquiry_id<=>OLD.inquiry_id) AND (EXISTS(SELECT 1 FROM quotation_item WHERE quotation_id=OLD.quotation_id) OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=OLD.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `quotation_item`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_item` (
  `quotation_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint unsigned NOT NULL,
  `inquiry_item_id` bigint unsigned DEFAULT NULL,
  `line_no` smallint unsigned NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `unit_price` decimal(15,4) NOT NULL,
  `line_total` decimal(19,2) GENERATED ALWAYS AS (round((`quantity` * `unit_price`),2)) STORED,
  PRIMARY KEY (`quotation_item_id`),
  UNIQUE KEY `uq_quotation_item_line` (`quotation_id`,`line_no`),
  KEY `inquiry_item_id` (`inquiry_item_id`),
  KEY `uom_id` (`uom_id`),
  CONSTRAINT `quotation_item_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotation` (`quotation_id`),
  CONSTRAINT `quotation_item_ibfk_2` FOREIGN KEY (`inquiry_item_id`) REFERENCES `inquiry_item` (`inquiry_item_id`),
  CONSTRAINT `quotation_item_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `ck_quotation_item_values` CHECK (((`line_no` > 0) and (`quantity` > 0) and (`unit_price` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_item`
--

LOCK TABLES `quotation_item` WRITE;
/*!40000 ALTER TABLE `quotation_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation_item` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `quote_item_source_bi` BEFORE INSERT ON `quotation_item` FOR EACH ROW BEGIN
IF NEW.inquiry_item_id IS NOT NULL AND (SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)<>(SELECT inquiry_id FROM inquiry_item WHERE inquiry_item_id=NEW.inquiry_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Quotation item must belong to the same inquiry'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `quote_item_source_bu` BEFORE UPDATE ON `quotation_item` FOR EACH ROW BEGIN
IF NEW.inquiry_item_id IS NOT NULL AND (SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)<>(SELECT inquiry_id FROM inquiry_item WHERE inquiry_item_id=NEW.inquiry_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Quotation item must belong to the same inquiry'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `quotation_item_quotation_id_history` BEFORE UPDATE ON `quotation_item` FOR EACH ROW BEGIN
IF NOT(NEW.quotation_id<=>OLD.quotation_id) AND (EXISTS(SELECT 1 FROM job_order_item WHERE quotation_item_id=OLD.quotation_item_id) OR EXISTS(SELECT 1 FROM cost_estimate WHERE quotation_item_id=OLD.quotation_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `raw_material`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `raw_material` (
  `material_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `material_category_id` bigint unsigned DEFAULT NULL,
  `material_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `qty_in_stock` decimal(15,4) DEFAULT NULL,
  `quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `unit_price` decimal(15,4) DEFAULT NULL,
  `unit_price_approved_by_user_id` bigint unsigned DEFAULT NULL,
  `unit_price_approved_at` datetime(3) DEFAULT NULL,
  `reference_unit_price` decimal(15,4) DEFAULT NULL,
  `reference_document_id` bigint unsigned DEFAULT NULL,
  `reference_page` smallint unsigned DEFAULT NULL,
  `reorder_threshold` decimal(15,4) DEFAULT NULL,
  `threshold_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `supplier_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`material_id`),
  KEY `ix_material_category_name` (`material_category_id`,`material_name`),
  KEY `uom_id` (`uom_id`),
  KEY `unit_price_approved_by_user_id` (`unit_price_approved_by_user_id`),
  KEY `reference_document_id` (`reference_document_id`),
  CONSTRAINT `raw_material_ibfk_1` FOREIGN KEY (`material_category_id`) REFERENCES `material_category` (`material_category_id`),
  CONSTRAINT `raw_material_ibfk_2` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `raw_material_ibfk_3` FOREIGN KEY (`unit_price_approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `raw_material_ibfk_4` FOREIGN KEY (`reference_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_raw_costing_price` CHECK ((((`unit_price` is null) and (`unit_price_approved_by_user_id` is null) and (`unit_price_approved_at` is null)) or ((`unit_price` is not null) and (`unit_price` >= 0) and (`unit_price_approved_by_user_id` is not null) and (`unit_price_approved_at` is not null)))),
  CONSTRAINT `ck_raw_quantity` CHECK ((((`quantity_status` = _utf8mb4'unknown') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`qty_in_stock` is not null) and (`qty_in_stock` >= 0)))),
  CONSTRAINT `ck_raw_threshold` CHECK ((((`threshold_status` = _utf8mb4'unknown') and (`reorder_threshold` is null)) or ((`threshold_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`reorder_threshold` is not null) and (`reorder_threshold` >= 0)))),
  CONSTRAINT `ck_reference_price` CHECK (((`reference_unit_price` is null) or (`reference_unit_price` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `raw_material`
--

LOCK TABLES `raw_material` WRITE;
/*!40000 ALTER TABLE `raw_material` DISABLE KEYS */;
/*!40000 ALTER TABLE `raw_material` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `raw_material_unit_history` BEFORE UPDATE ON `raw_material` FOR EACH ROW BEGIN
IF NEW.uom_id<>OLD.uom_id AND (EXISTS(SELECT 1 FROM stock_movement WHERE raw_material_id=OLD.material_id) OR EXISTS(SELECT 1 FROM stock_request_item WHERE raw_material_id=OLD.material_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unit conversion requires separate approved reconciliation'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `role`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `role_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_name` enum('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_owner_role` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_name` (`role_name`),
  CONSTRAINT `ck_role_owner` CHECK ((`is_owner_role` = (`role_name` = _utf8mb4'Owner')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role`
--

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `role_identity_history` BEFORE UPDATE ON `role` FOR EACH ROW BEGIN
IF NOT(NEW.role_name<=>OLD.role_name) AND EXISTS(SELECT 1 FROM user_account WHERE role_id=OLD.role_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot relabel a role used by accounts'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `sales_invoice`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_invoice` (
  `invoice_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_id` bigint unsigned NOT NULL,
  `invoice_date` date NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivered_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_by_user_id` bigint unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `uq_invoice_number` (`invoice_no`),
  UNIQUE KEY `uq_invoice_po` (`po_id`),
  KEY `ix_invoice_due` (`status`,`due_date`),
  KEY `issued_by_user_id` (`issued_by_user_id`),
  CONSTRAINT `sales_invoice_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_order` (`po_id`),
  CONSTRAINT `sales_invoice_ibfk_2` FOREIGN KEY (`issued_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_invoice_total` CHECK ((`total_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_invoice`
--

LOCK TABLES `sales_invoice` WRITE;
/*!40000 ALTER TABLE `sales_invoice` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_invoice` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `sales_invoice_po_id_history` BEFORE UPDATE ON `sales_invoice` FOR EACH ROW BEGIN
IF NOT(NEW.po_id<=>OLD.po_id) AND (EXISTS(SELECT 1 FROM client_receipt WHERE invoice_id=OLD.invoice_id) OR EXISTS(SELECT 1 FROM payment_transaction WHERE invoice_id=OLD.invoice_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `signed_delivery_receipt`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signed_delivery_receipt` (
  `signed_dr_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_receipt_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `submitted_by_user_id` bigint unsigned NOT NULL,
  `submitted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `received_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`signed_dr_id`),
  UNIQUE KEY `uq_signed_dr_document` (`document_id`),
  KEY `delivery_receipt_id` (`delivery_receipt_id`),
  KEY `submitted_by_user_id` (`submitted_by_user_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_1` FOREIGN KEY (`delivery_receipt_id`) REFERENCES `delivery_receipt` (`delivery_receipt_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_3` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signed_delivery_receipt`
--

LOCK TABLES `signed_delivery_receipt` WRITE;
/*!40000 ALTER TABLE `signed_delivery_receipt` DISABLE KEYS */;
/*!40000 ALTER TABLE `signed_delivery_receipt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movement`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movement` (
  `movement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_type` enum('raw_material','finished_good') COLLATE utf8mb4_unicode_ci NOT NULL,
  `raw_material_id` bigint unsigned DEFAULT NULL,
  `finished_good_id` bigint unsigned DEFAULT NULL,
  `movement_reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_status_before` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty_before` decimal(15,4) DEFAULT NULL,
  `qty_after` decimal(15,4) NOT NULL,
  `qty_change` decimal(15,4) DEFAULT NULL,
  `uom_id` bigint unsigned DEFAULT NULL,
  `reference_no` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jo_id` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `performed_by_user_id` bigint unsigned NOT NULL,
  `operation_key` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`movement_id`),
  UNIQUE KEY `uq_stock_operation` (`operation_key`),
  KEY `ix_raw_movement_history` (`raw_material_id`,`created_at`,`movement_id`),
  KEY `ix_finished_movement_history` (`finished_good_id`,`created_at`,`movement_id`),
  KEY `uom_id` (`uom_id`),
  KEY `jo_id` (`jo_id`),
  KEY `performed_by_user_id` (`performed_by_user_id`),
  CONSTRAINT `stock_movement_ibfk_1` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `stock_movement_ibfk_2` FOREIGN KEY (`finished_good_id`) REFERENCES `finished_good` (`finished_good_id`),
  CONSTRAINT `stock_movement_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `stock_movement_ibfk_4` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `stock_movement_ibfk_5` FOREIGN KEY (`performed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_finished_movement_units` CHECK (((`item_type` <> _utf8mb4'finished_good') or ((`qty_after` = floor(`qty_after`)) and ((`qty_before` is null) or (`qty_before` = floor(`qty_before`)))))),
  CONSTRAINT `ck_stock_item_xor` CHECK ((((`item_type` = _utf8mb4'raw_material') and (`raw_material_id` is not null) and (`finished_good_id` is null) and (`uom_id` is not null)) or ((`item_type` = _utf8mb4'finished_good') and (`raw_material_id` is null) and (`finished_good_id` is not null) and (`uom_id` is null)))),
  CONSTRAINT `ck_stock_observation` CHECK (((`qty_after` >= 0) and (((`quantity_status_before` = _utf8mb4'verified') and (`qty_before` is not null) and (`qty_before` >= 0) and (`qty_change` is not null) and (`qty_after` = (`qty_before` + `qty_change`))) or ((`quantity_status_before` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`qty_before` is null) and (`qty_change` is null))))),
  CONSTRAINT `ck_stock_reason` CHECK ((char_length(trim(`movement_reason`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movement`
--

LOCK TABLES `stock_movement` WRITE;
/*!40000 ALTER TABLE `stock_movement` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_movement` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `movement_jo_client_bi` BEFORE INSERT ON `stock_movement` FOR EACH ROW BEGIN
IF NEW.finished_good_id IS NOT NULL AND NEW.jo_id IS NOT NULL AND (SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finished good and JO must belong to the same client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `raw_movement_unit_bi` BEFORE INSERT ON `stock_movement` FOR EACH ROW BEGIN
IF NEW.raw_material_id IS NOT NULL AND NEW.uom_id<>(SELECT uom_id FROM raw_material WHERE material_id=NEW.raw_material_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Raw movement must use the recorded stock unit'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `movement_jo_client_bu` BEFORE UPDATE ON `stock_movement` FOR EACH ROW BEGIN
IF NEW.finished_good_id IS NOT NULL AND NEW.jo_id IS NOT NULL AND (SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finished good and JO must belong to the same client'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `stock_movement_append_only_update` BEFORE UPDATE ON `stock_movement` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `raw_movement_unit_bu` BEFORE UPDATE ON `stock_movement` FOR EACH ROW BEGIN
IF NEW.raw_material_id IS NOT NULL AND NEW.uom_id<>(SELECT uom_id FROM raw_material WHERE material_id=NEW.raw_material_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Raw movement must use the recorded stock unit'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `stock_movement_append_only_delete` BEFORE DELETE ON `stock_movement` FOR EACH ROW BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `stock_request`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_request` (
  `stock_request_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_id` bigint unsigned NOT NULL,
  `requested_by_user_id` bigint unsigned NOT NULL,
  `handled_by_user_id` bigint unsigned DEFAULT NULL,
  `request_date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`stock_request_id`),
  KEY `ix_stock_request_queue` (`status`,`request_date`),
  KEY `inquiry_id` (`inquiry_id`),
  KEY `requested_by_user_id` (`requested_by_user_id`),
  KEY `handled_by_user_id` (`handled_by_user_id`),
  CONSTRAINT `stock_request_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `stock_request_ibfk_2` FOREIGN KEY (`requested_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `stock_request_ibfk_3` FOREIGN KEY (`handled_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_request`
--

LOCK TABLES `stock_request` WRITE;
/*!40000 ALTER TABLE `stock_request` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_request_item`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_request_item` (
  `stock_request_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stock_request_id` bigint unsigned NOT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_requested` decimal(15,4) NOT NULL,
  `stock_at_request` decimal(15,4) DEFAULT NULL,
  `qty_available` decimal(15,4) DEFAULT NULL,
  `shortage_at_request` decimal(15,4) DEFAULT NULL,
  `quantity_status_at_request` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL,
  `available_quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observed_at` datetime(3) DEFAULT NULL,
  `observed_by_user_id` bigint unsigned DEFAULT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`stock_request_item_id`),
  UNIQUE KEY `uq_request_material` (`stock_request_id`,`raw_material_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `uom_id` (`uom_id`),
  KEY `observed_by_user_id` (`observed_by_user_id`),
  CONSTRAINT `stock_request_item_ibfk_1` FOREIGN KEY (`stock_request_id`) REFERENCES `stock_request` (`stock_request_id`),
  CONSTRAINT `stock_request_item_ibfk_2` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `stock_request_item_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `stock_request_item_ibfk_4` FOREIGN KEY (`observed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_request_response` CHECK ((((`available_quantity_status` is null) and (`qty_available` is null) and (`observed_at` is null) and (`observed_by_user_id` is null)) or ((`available_quantity_status` is not null) and (`observed_at` is not null) and (`observed_by_user_id` is not null) and (((`available_quantity_status` = _utf8mb4'verified') and (`qty_available` is not null) and (`qty_available` >= 0)) or ((`available_quantity_status` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`qty_available` is null)))))),
  CONSTRAINT `ck_request_snapshot_provenance` CHECK ((((`quantity_status_at_request` = _utf8mb4'verified') and (`stock_at_request` is not null) and (`stock_at_request` >= 0) and (`shortage_at_request` is not null) and (`shortage_at_request` = greatest((`qty_requested` - `stock_at_request`),0))) or ((`quantity_status_at_request` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`stock_at_request` is null) and (`shortage_at_request` is null)))),
  CONSTRAINT `ck_requested_quantity` CHECK ((`qty_requested` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_request_item`
--

LOCK TABLES `stock_request_item` WRITE;
/*!40000 ALTER TABLE `stock_request_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_request_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `unit_of_measure`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unit_of_measure` (
  `uom_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uom_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abbreviation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`uom_id`),
  UNIQUE KEY `uq_uom_name` (`uom_name`),
  UNIQUE KEY `uq_uom_abbreviation` (`abbreviation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `unit_of_measure`
--

LOCK TABLES `unit_of_measure` WRITE;
/*!40000 ALTER TABLE `unit_of_measure` DISABLE KEYS */;
/*!40000 ALTER TABLE `unit_of_measure` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_account`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_account` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `full_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `initials` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '1',
  `joined_date` date DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_account_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`),
  CONSTRAINT `ck_user_password_flag` CHECK ((`must_change_password` in (0,1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_account`
--

LOCK TABLES `user_account` WRITE;
/*!40000 ALTER TABLE `user_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_account` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `user_account_portal_role` BEFORE UPDATE ON `user_account` FOR EACH ROW BEGIN
IF EXISTS(SELECT 1 FROM client_user WHERE client_user_id=OLD.user_id) AND (SELECT role_name FROM role WHERE role_id=NEW.role_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal identity must retain Client role'; END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `waybill`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `waybill` (
  `waybill_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `waybill_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_identifier` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `generated_by_user_id` bigint unsigned NOT NULL,
  `generated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `printed_at` datetime(3) DEFAULT NULL,
  `document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`waybill_id`),
  UNIQUE KEY `uq_waybill_delivery` (`delivery_id`),
  UNIQUE KEY `uq_waybill_number` (`waybill_no`),
  UNIQUE KEY `uq_waybill_qr` (`qr_identifier`),
  KEY `generated_by_user_id` (`generated_by_user_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `waybill_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `waybill_ibfk_2` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `waybill_ibfk_3` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `waybill`
--

LOCK TABLES `waybill` WRITE;
/*!40000 ALTER TABLE `waybill` DISABLE KEYS */;
/*!40000 ALTER TABLE `waybill` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'enterflow_phase2_db'
--

--
-- Dumping routines for database 'enterflow_phase2_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
