import { CustomersController } from './customers/customers.controller.js';
import { OrdersController } from './orders/orders.controller.js';

/** Controllers das fatias comerciais (fases 3+), registrados aqui para manter app.ts estável. */
export const FEATURE_CONTROLLERS = [CustomersController, OrdersController];
