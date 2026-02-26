/**
 * Admin-only API. Re-exports from split modules.
 * All functions enforce the admin allowlist (adminUsers / userRoles table).
 */

export {
  addFirstAdmin,
  isAdmin,
  adminProfileGet,
  adminProfileSetAvatar,
  conversationsListThreads,
  conversationsListUsersWithThreads,
  conversationsGetThreadMessages,
  conversationsGetThreadTraces,
} from "../../admin/setup";

export {
  overviewStats,
  getMyAdminStats,
  dashboardStats,
  dashboardChartData,
  topSearchedAreas,
  salesActivityFeed,
  aiTokenUsageStats,
  searchAnalyticsStats,
  aiUsageChartData,
} from "../../admin/dashboard";

export {
  verifiedPhonesList,
  pendingVerificationsList,
  otpRequestsList,
  sessionTokensList,
  verifiedPhoneAdd,
  verifiedPhoneRemove,
  verifiedPhonesCombine,
} from "../../admin/auth";

export {
  listUsers,
  listTeamMembers,
  usersList,
  usersGetByUserId,
  getUser,
  setUserRole,
  setUserRoleByUserId,
  notificationsList,
  notificationsUnreadCount,
  notificationAcknowledge,
  notificationResolve,
  reviewsList,
  favoritesList,
  getUserFullData,
  updateUserProfile,
  generateUserSummary,
} from "../../admin/users";

export {
  getTotalAICostsByUserId,
  getToolCostsByUserId,
} from "../../admin/costs";

export { listWhatsAppInboundMessages } from "../../admin/whatsapp";

export { agentLLMConfig } from "../../admin/agentConfig";

export {
  aiSettingsList,
  aiSettingsGet,
  aiSettingsUpdate,
  aiSettingsBatchUpdate,
  aiSettingsReset,
} from "../../admin/aiSettings";

export {
  handoffsList,
  handoffUpdateStatus,
  promptsList,
  promptUpdate,
  knowledgeList,
  knowledgeCreate,
  knowledgeUpdate,
  knowledgeRemove,
  knowledgeResearchList,
} from "../../admin/content";

export {
  partnersList,
  partnerGet,
  partnerCreate,
  partnerUpdate,
  partnerRemove,
  banksList,
  bankGet,
  bankCreate,
  bankUpdate,
  bankRemove,
  bankProductsList,
  bankProductGet,
  bankProductCreate,
  bankProductUpdate,
  bankProductRemove,
  propertiesList,
  propertyCreate,
  propertyUpdate,
  propertyRemove,
  propertyGet,
  propertyBanksListByProperty,
  propertyBanksSet,
} from "../../admin/entities";

export {
  listOrders,
  ordersList,
  pipelineSummary,
  pipelineBoard,
  ordersForUser,
  ordersForProperty,
  ordersForBank,
  orderGet,
  getOrder,
  conversationReasonsForUser,
  conversationReasonsForOrder,
  orderCreate,
  createDraftOrderFromAgent,
  orderUpdate,
  orderRemove,
} from "../../admin/orders";

export {
  generatePendingActionUploadUrl,
  attachPendingActionMedia,
  removePendingActionMedia,
  reorderPendingActionMedia,
  listPendingActionMedia,
  cancelPendingAction,
  confirmPendingAction,
} from "./agentActions";
