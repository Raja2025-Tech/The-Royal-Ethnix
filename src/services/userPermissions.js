import { createPermissions } from '@/services/permissions';

export const PROFILES = {
  Owner_c: {
    label: 'Admin',
    isDefault: false,
    isPublic: false,
    canManageTeam: true,
    reportsTo: null,
  },
  Manager_c: {
    label: 'Manager',
    isDefault: false,
    isPublic: false,
    canManageTeam: false,
    reportsTo: 'Owner_c',
  },
  Staff_c: {
    label: 'Counter Staff',
    isDefault: true,
    isPublic: false,
    canManageTeam: false,
    reportsTo: 'Owner_c',
  },
  CadMaster_c: {
    label: 'CAD Master',
    isDefault: false,
    isPublic: false,
    canManageTeam: false,
    reportsTo: 'Owner_c',
  },
  Karigar_c: {
    label: 'Karigar',
    isDefault: false,
    isPublic: false,
    canManageTeam: false,
    reportsTo: 'Owner_c',
  },
};

// Karigars may change only the stage, their own rate (wage_c) and their note on a garment.
const KARIGAR_LOCKED_ITEM_FIELDS = [
  'Name', 'order_c', 'kind_c', 'category_c', 'karigar_c', 'karigar2_c', 'karigar3_c', 'handwork_c', 'cad_c', 'cad_date_c', 'fabric_unit_c',
  'due_date_c', 'sleeve_type_c', 'qty_c', 'size_c', 'width_c',
  'fabric_c', 'fabric_qty_c', 'fabric_given_on_c', 'fabric_note_c', 'received_on_c', 'received_note_c',
  'design_c', 'photos_c', 'fabric_photos_c', 'length_c', 'shoulder_c', 'sleeve_c', 'chest_c', 'belly_c', 'hip_c',
  'mohri_c', 'cuff_c', 'neck_c', 'armhole_c', 'bicep_c', 'waist_c', 'fork_c', 'thigh_c', 'downfall_c',
];

// The CAD Master may change only the CAD stage and date of a garment.
const CAD_LOCKED_ITEM_FIELDS = [
  'Name', 'order_c', 'kind_c', 'category_c', 'karigar_c', 'karigar2_c', 'karigar3_c', 'handwork_c', 'status_c', 'fabric_unit_c',
  'due_date_c', 'sleeve_type_c', 'qty_c', 'size_c', 'width_c', 'karigar_note_c',
  'fabric_c', 'fabric_qty_c', 'fabric_given_on_c', 'fabric_note_c', 'received_on_c', 'received_note_c',
  'design_c', 'photos_c', 'fabric_photos_c', 'length_c', 'shoulder_c', 'sleeve_c', 'chest_c', 'belly_c', 'hip_c',
  'mohri_c', 'cuff_c', 'neck_c', 'armhole_c', 'bicep_c', 'waist_c', 'fork_c', 'thigh_c', 'downfall_c',
];

const ORDER_FINANCE_FIELDS = ['total_c', 'discount_c', 'cash_c', 'card_c', 'upi_c', 'paid_c'];

// The CAD Master may change only the CAD pattern stage and pattern date on an order.
const CAD_LOCKED_ORDER_FIELDS = [
  'Name', 'bill_no_c', 'customer_c', 'order_date_c', 'trial_date_c', 'delivery_date_c', 'event_date_c',
  'priority_c', 'status_c', 'remark_c',
];

const TABLE_PERMISSIONS = {
  Owner_c: {
    customers_c: { access: 'Full' },
    orders_c: { access: 'Full' },
    order_items_c: { access: 'Full' },
    karigars_c: { access: 'Full' },
    categories_c: { access: 'Full' },
    karigar_payments_c: { access: 'Full' },
    cashbook_c: { access: 'Full' },
    audit_log_c: { access: 'Read,Create' },
    stock_items_c: { access: 'Full' },
    stock_moves_c: { access: 'Full' },
  },
  Manager_c: {
    customers_c: { access: 'Read,Create' },
    orders_c: { access: 'Read,Create' },
    order_items_c: { access: 'Read,Create' },
    karigars_c: { access: 'Read,Create' },
    categories_c: { access: 'Read,Create' },
    karigar_payments_c: { access: 'Read,Create' },
    cashbook_c: { access: 'Read,Create' },
    audit_log_c: { access: 'Read,Create' },
    stock_items_c: { access: 'Read,Create' },
    stock_moves_c: { access: 'Read,Create' },
  },
  Staff_c: {
    customers_c: { access: 'Read,Create,Update' },
    orders_c: { access: 'Read,Create,Update' },
    order_items_c: { access: 'Read,Create,Update', inaccessibleFields: ['wage_c', 'wage2_c', 'wage3_c', 'karigar_note_c'] },
    karigars_c: { access: 'Read' },
    categories_c: { access: 'Read' },
    karigar_payments_c: { access: 'Inaccessible' },
    cashbook_c: { access: 'Read,Create' },
    audit_log_c: { access: 'Create' },
    stock_items_c: { access: 'Read' },
    stock_moves_c: { access: 'Read,Create' },
  },
  CadMaster_c: {
    customers_c: { access: 'Inaccessible' },
    orders_c: {
      access: 'Read,Update',
      inaccessibleFields: ORDER_FINANCE_FIELDS,
      readOnlyFields: CAD_LOCKED_ORDER_FIELDS,
    },
    order_items_c: {
      access: 'Read,Update',
      inaccessibleFields: ['wage_c', 'wage2_c', 'wage3_c'],
      readOnlyFields: CAD_LOCKED_ITEM_FIELDS,
    },
    karigars_c: { access: 'Inaccessible' },
    categories_c: { access: 'Read' },
    karigar_payments_c: { access: 'Inaccessible' },
    cashbook_c: { access: 'Inaccessible' },
    audit_log_c: { access: 'Create' },
    stock_items_c: { access: 'Inaccessible' },
    stock_moves_c: { access: 'Inaccessible' },
  },
  Karigar_c: {
    customers_c: { access: 'Inaccessible' },
    orders_c: { access: 'Inaccessible' },
    order_items_c: { access: 'Read,Update', readOnlyFields: KARIGAR_LOCKED_ITEM_FIELDS },
    karigars_c: { access: 'Read' },
    categories_c: { access: 'Inaccessible' },
    karigar_payments_c: { access: 'Read' },
    cashbook_c: { access: 'Inaccessible' },
    audit_log_c: { access: 'Create' },
    stock_items_c: { access: 'Inaccessible' },
    stock_moves_c: { access: 'Inaccessible' },
  },
};

export const { getProfileMeta, getTableAccess, getFieldAccess } = createPermissions(PROFILES, TABLE_PERMISSIONS);
