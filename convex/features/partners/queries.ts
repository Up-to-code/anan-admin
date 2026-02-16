/**
 * Partners - re-exports from services and admin.
 * @deprecated Use api.services.partners or api.admin.entities for new code.
 */
export { list, addProperty, listPropertiesByPartner } from "../../services/partners";
export {
  partnerGet as get,
  partnerCreate as create,
  partnerUpdate as update,
  partnerRemove as remove,
} from "../../admin/entities";
