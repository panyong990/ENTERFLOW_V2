export async function readWarehouseSnapshot(db, work) {
  let connection;
  let reusable = false;

  try {
    connection = await db.getConnection();

    await connection.query(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
    );

    await connection.query(
      'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY'
    );

    try {
      return await work(connection);
    } finally {
      await connection.rollback();
      reusable = true;
    }
  } finally {
    if (connection) {
      if (reusable) {
        connection.release();
      } else {
        connection.destroy();
      }
    }
  }
}
