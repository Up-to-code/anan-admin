/**
 * Banks - re-exports from services and admin.
 * @deprecated Use api.services.banks or api.admin.entities for new code.
 */
export { list, getById, getBySlug, getBundles } from "../../services/banks";
export {
  bankGet as get,
  bankCreate as create,
  bankUpdate as update,
} from "../../admin/entities";
