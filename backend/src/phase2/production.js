import { ok, read, rows, one, id, text, object, requireThat, paging, transaction, lockInquiry, inquiryFor, insert, changed, audit, date, decimal, format } from './core.js';
export function createProductionJobOrdersService({
  db
}) {
  return {
    list: (query = {}) => read(db, async c => {
      object(query, ['q', 'status', 'page', 'pageSize', 'limit']);
      const {
          page,
          pageSize,
          offset
        } = paging(query),
        params = [],
        where = ['1=1'];
      if (query.q) {
        const search = text(query.q, 254);
        where.push('(j.jo_no LIKE ? OR i.inquiry_no LIKE ? OR cl.company_name LIKE ?)');
        params.push(...Array(3).fill('%' + search + '%'));
      }
      if (query.status && query.status !== 'all') {
        requireThat(['jo', 'prepared', 'in_production', 'ready_for_dispatch', 'delivered', 'cancelled'].includes(query.status));
        where.push('j.status=?');
        params.push(query.status === 'jo' ? 'prepared' : query.status);
      }
      const from = 'job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id JOIN client cl ON cl.client_id=i.client_id',
        filter = where.join(' AND ');
      const count = await one(c, `SELECT COUNT(*) total FROM ${from} WHERE ${filter}`, params);
      const items = await rows(c, `SELECT CAST(j.jo_id AS CHAR) id,j.jo_no reference,CAST(j.po_id AS CHAR) purchaseOrderId,CAST(i.inquiry_id AS CHAR) orderId,CAST(i.client_id AS CHAR) clientId,cl.company_name clientName,i.inquiry_no inquiryReference,j.status,j.jo_date createdAt,j.due_date productionDueDate,j.completed_at completedAt,(SELECT SUM(ji.quantity) FROM job_order_item ji WHERE ji.jo_id=j.jo_id) quantity,EXISTS(SELECT 1 FROM production_plan pp WHERE pp.jo_id=j.jo_id AND pp.source='rush') rush FROM ${from} WHERE ${filter} ORDER BY rush DESC,j.due_date,j.jo_id LIMIT ? OFFSET ?`, [...params, String(pageSize), String(offset)]);
      return ok({
        items,
        total: Number(count.total),
        page,
        pageSize
      });
    }),
    detail: target => read(db, async c => {
      requireThat(id(target));
      const job = await one(c, 'SELECT CAST(jo_id AS CHAR) id,jo_no reference,CAST(po_id AS CHAR) purchaseOrderId,status,due_date productionDueDate,payment_terms paymentTermCode,po_verified poVerified,specs_verified specsVerified,terms_verified termsVerified,completed_at completedAt FROM job_order WHERE jo_id=?', [target]);
      requireThat(job, 'NOT_FOUND');
      const items = await rows(c, 'SELECT CAST(jo_item_id AS CHAR) id,CAST(quotation_item_id AS CHAR) quotationItemId,item_name itemName,quantity,od1_mm od1,od2_mm od2,id1_mm id1,id2_mm id2,height_mm height,overall_height_mm overallHeight,filter_media media,inner_core innerCore,outer_core outerCore,o_ring oring,gasket,template_specifications_snapshot templateSpecifications,CAST(final_sketch_document_id AS CHAR) sketchDocumentId FROM job_order_item WHERE jo_id=? ORDER BY line_no', [target]);
      const stages = await rows(c, 'SELECT CAST(js.jo_stage_id AS CHAR) id,CAST(js.stage_id AS CHAR) stageId,s.stage_name label,s.stage_order-1 position,js.status,js.started_at startedAt,js.completed_at completedAt FROM job_order_stage js JOIN production_stage s ON s.stage_id=js.stage_id WHERE js.jo_id=? ORDER BY s.stage_order', [target]);
      const events = await rows(c, 'SELECT CAST(e.stage_event_id AS CHAR) id,CAST(e.jo_stage_id AS CHAR) stageId,ps.stage_name stageLabel,ps.stage_order-1 stagePosition,e.action,e.reason,e.occurred_at occurredAt FROM production_stage_event e JOIN job_order_stage js ON js.jo_stage_id=e.jo_stage_id JOIN production_stage ps ON ps.stage_id=js.stage_id WHERE js.jo_id=? ORDER BY e.stage_event_id', [target]);
      const po = await one(c, 'SELECT CAST(p.po_id AS CHAR) id,p.po_no reference,CAST(p.quotation_id AS CHAR) acceptedQuotationId,q.quotation_no acceptedQuotationReference,p.received_date receivedAt,d.storage_status documentStatus FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id JOIN document d ON d.document_id=p.po_document_id WHERE p.po_id=?', [job.purchaseOrderId]);
      const plans=await rows(c,'SELECT CAST(plan_id AS CHAR) id,plan_code reference,source,planned_qty quantity,week_start_date weekStartDate,week_end_date weekEndDate FROM production_plan WHERE jo_id=? ORDER BY week_start_date,plan_id',[target]);
      const shortages=await rows(c,'SELECT CAST(r.report_id AS CHAR) id,CAST(r.jo_stage_id AS CHAR) stageId,CAST(r.raw_material_id AS CHAR) materialId,m.material_name materialName,r.qty_needed quantityNeeded,r.description,r.status,r.reported_at reportedAt,r.resolved_at resolvedAt FROM material_shortage_report r JOIN raw_material m ON m.material_id=r.raw_material_id WHERE r.jo_id=? ORDER BY r.report_id',[target]);
      return ok({
        ...job,plans,shortages,
        paymentTermLabel: job.paymentTermCode === 'NET15' ? '15-Day Terms' : job.paymentTermCode === 'NET30' ? '30-Day Terms' : null,
        items,
        stages,
        events,
        productionEvents: events,
        trace: {
          acceptedQuotationId: po?.acceptedQuotationId ?? null,
          acceptedQuotationReference: po?.acceptedQuotationReference ?? null,
          purchaseOrderId: po?.id ?? null,
          purchaseOrderReference: po?.reference ?? null
        },
        purchaseOrder: po ? {
          id: po.id,
          reference: po.reference,
          receivedAt: po.receivedAt
        } : null,
        poDocumentAvailable: po?.documentStatus === 'available'
      });
    }),
    stage: (actor, target, body) => transaction(db, actor, ['production', 'admin'], async (c, a) => {
      requireThat(id(target));
      object(body, ['stageId', 'action', 'reason']);
      requireThat(id(body.stageId) && ['start', 'complete', 'revert'].includes(body.action));
      const inquiryId = await inquiryFor(c, 'job_order', 'jo_id', target);
      await lockInquiry(c, inquiryId);
      const job = await one(c, 'SELECT * FROM job_order WHERE jo_id=? FOR UPDATE', [target]);
      requireThat(['prepared', 'in_production', 'ready_for_dispatch'].includes(job.status), 'INVALID_STATE');
      if (body.action === 'revert') requireThat(!(await one(c, "SELECT delivery_id FROM delivery WHERE jo_id=? AND status<>'cancelled' LIMIT 1", [target])), 'INVALID_STATE');
      const stages = await rows(c, 'SELECT js.*,s.stage_order FROM job_order_stage js JOIN production_stage s ON s.stage_id=js.stage_id WHERE js.jo_id=? ORDER BY s.stage_order FOR UPDATE', [target]);
      const index = stages.findIndex(s => String(s.jo_stage_id) === body.stageId);
      requireThat(index >= 0, 'NOT_FOUND');
      const stage = stages[index];
      if (body.action === 'start') {
        requireThat(stage.status === 'pending' && stages.slice(0, index).every(s => s.status === 'completed'), 'INVALID_STATE');
        await changed(c, "UPDATE job_order_stage SET status='in_progress',started_at=UTC_TIMESTAMP(3),completed_at=NULL,marked_by_user_id=? WHERE jo_stage_id=?", [a.userId, body.stageId]);
      }
      if (body.action === 'complete') {
        requireThat(stage.status === 'in_progress' && stages.slice(0, index).every(s => s.status === 'completed'), 'INVALID_STATE');
        await changed(c, "UPDATE job_order_stage SET status='completed',completed_at=UTC_TIMESTAMP(3),marked_by_user_id=? WHERE jo_stage_id=?", [a.userId, body.stageId]);
      }
      if (body.action === 'revert') {
        requireThat(['completed', 'in_progress'].includes(stage.status) && stages.slice(index + 1).every(s => s.status === 'pending'), 'INVALID_STATE');
        text(body.reason);
        await changed(c, "UPDATE job_order_stage SET status='pending',started_at=NULL,completed_at=NULL,reverted_count=reverted_count+1,marked_by_user_id=? WHERE jo_stage_id=?", [a.userId, body.stageId]);
      }
      const completed = body.action === 'complete' && index === stages.length - 1;
      await changed(c, `UPDATE job_order SET status=?,completed_at=${completed ? 'UTC_TIMESTAMP(3)' : 'NULL'} WHERE jo_id=?`, [completed ? 'ready_for_dispatch' : 'in_production', target]);
      await changed(c, 'UPDATE inquiry SET status=? WHERE inquiry_id=?', [completed ? 'ready_for_dispatch' : 'in_production', inquiryId]);
      await insert(c, 'INSERT INTO production_stage_event(jo_stage_id,action,reason,performed_by_user_id) VALUES (?,?,?,?)', [body.stageId, body.action === 'revert' ? 'reverted' : body.action === 'complete' ? 'completed' : 'started', body.reason ?? null, a.userId]);
      await audit(c, a, 'production.stage_changed', 'job_order_stage', body.stageId, {
        status: stage.status
      }, {
        action: body.action
      }, body.reason ?? null);
      return ok({
        id: body.stageId,
        action: body.action
      });
    }),
    schedule: (actor, body) => transaction(db, actor, ['production', 'admin'], async (c, a) => {
      object(body, ['jobOrderId', 'planCode', 'quantity', 'weekStartDate', 'weekEndDate', 'rush']);
      requireThat(id(body.jobOrderId) && Number.isInteger(body.quantity) && body.quantity > 0);
      date(body.weekStartDate);
      date(body.weekEndDate);
      requireThat(body.weekEndDate >= body.weekStartDate);
      requireThat(body.rush === undefined || typeof body.rush === 'boolean');
      const inquiryId = await inquiryFor(c, 'job_order', 'jo_id', body.jobOrderId),
        i = await lockInquiry(c, inquiryId);
      const j = await one(c, 'SELECT status FROM job_order WHERE jo_id=? FOR UPDATE', [body.jobOrderId]);
      requireThat(!['completed', 'delivered', 'cancelled'].includes(j.status), 'INVALID_STATE');
      const capacity = await one(c, 'SELECT (SELECT COALESCE(SUM(quantity),0) FROM job_order_item WHERE jo_id=?) ordered,(SELECT COALESCE(SUM(planned_qty),0) FROM production_plan WHERE jo_id=?) planned', [body.jobOrderId, body.jobOrderId]);
      requireThat(BigInt(body.quantity) + BigInt(capacity.planned) <= BigInt(capacity.ordered), 'INVALID_STATE');
      const plan = await insert(c, 'INSERT INTO production_plan(plan_code,client_id,jo_id,source,planned_qty,week_start_date,week_end_date,created_by_user_id) VALUES (?,?,?,?,?,?,?,?)', [text(body.planCode, 60), i.clientId, body.jobOrderId, body.rush === true ? 'rush' : 'scheduled', body.quantity, body.weekStartDate, body.weekEndDate, a.userId]);
      await audit(c, a, 'production.scheduled', 'production_plan', plan, null, {
        jobOrderId: body.jobOrderId,
        quantity: body.quantity,
        rush: body.rush === true
      });
      return ok({
        id: plan
      });
    }),
    shortage: (actor, body) => transaction(db, actor, ['production', 'admin'], async (c, a) => {
      object(body, ['jobOrderId', 'stageId', 'materialId', 'quantity', 'description']);
      requireThat(id(body.jobOrderId) && id(body.materialId));
      const inquiryId = await inquiryFor(c, 'job_order', 'jo_id', body.jobOrderId);
      await lockInquiry(c, inquiryId);
      const needed = decimal(body.quantity);
      requireThat(needed > 0n);
      const qty = format(needed);
      if (body.stageId) requireThat(id(body.stageId) && (await one(c, 'SELECT jo_stage_id FROM job_order_stage WHERE jo_stage_id=? AND jo_id=?', [body.stageId, body.jobOrderId])), 'NOT_FOUND');
      const report = await insert(c, "INSERT INTO material_shortage_report(jo_id,jo_stage_id,raw_material_id,qty_needed,description,status,reported_by_user_id) VALUES (?,?,?,?,?,'pending',?)", [body.jobOrderId, body.stageId ?? null, body.materialId, qty, text(body.description), a.userId]);
      await audit(c, a, 'material.shortage_reported', 'material_shortage_report', report, null, {
        jobOrderId: body.jobOrderId,
        materialId: body.materialId,
        quantity: qty
      });
      return ok({
        id: report
      });
    })
  };
}
