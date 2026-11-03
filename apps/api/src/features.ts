import {
  AttachmentsController,
  LocalStorageController,
} from './attachments/attachments.controller.js';
import { OpsController } from './ops/ops.controller.js';
import { CustomersController } from './customers/customers.controller.js';
import { OrdersController } from './orders/orders.controller.js';
import { PublicQuoteController } from './quotes/public-quote.controller.js';
import { QuotesController } from './quotes/quotes.controller.js';
import { AppointmentsController } from './scheduling/appointments.js';

/** Controllers das fatias comerciais (fases 3+), registrados aqui para manter app.ts estável. */
export const FEATURE_CONTROLLERS = [
  CustomersController,
  OrdersController,
  QuotesController,
  PublicQuoteController,
  AppointmentsController,
  AttachmentsController,
  LocalStorageController,
  OpsController,
];
