/**
 * Properties - re-exports from services and admin.
 * @deprecated Use api.services.properties or api.admin.entities for new code.
 */
export {
  list,
  search,
  searchPaginated,
  getById,
  getById as get,
} from "../../services/properties";
export {
  propertyCreate as create,
  propertyUpdate as update,
} from "../../admin/entities";
