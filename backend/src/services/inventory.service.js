export function createInventoryService({ db }) {
  async function list() {
    const connection = await db.getConnection();
    try {
      const [materials] = await connection.execute(`SELECT CAST(m.id AS CHAR) id, m.name, m.category_code category, m.unit_code unit, m.unit_price unitPrice, m.quantity_on_hand qtyInStock, m.reorder_threshold threshold, m.supplier_name supplier, DATE_FORMAT(m.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updatedAt FROM materials m WHERE m.active=TRUE ORDER BY m.name,m.id`);
      const [finishedGoods] = await connection.execute(`SELECT CAST(fg.id AS CHAR) id, fg.item_code itemCode, fg.enterfil_part_number enterFilPN, fg.quantity_on_hand qtyInStock, fg.buffer_minimum bufferMin, fg.demand, DATE_FORMAT(fg.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') lastUpdated FROM finished_goods fg ORDER BY fg.item_code,fg.id`);
      return { success: true, data: { materials, finishedGoods } };
    } finally { connection.release(); }
  }
  return { list };
}
