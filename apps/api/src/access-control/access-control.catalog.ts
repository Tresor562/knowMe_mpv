export const PERMISSIONS = {
  DASHBOARD_READ: 'admin.dashboard.read',
  REPORTS_READ: 'moderation.reports.read',
  REPORTS_RESOLVE: 'moderation.reports.resolve',
  AUDIT_READ: 'audit.logs.read',
  USER_SUSPENSION_MANAGE: 'users.suspension.manage',
  FEATURE_FLAGS_MANAGE: 'feature_flags.manage',
  ENTITLEMENTS_MANAGE: 'entitlements.manage',
  STAFF_MANAGE: 'staff.manage',
  WALLET_MANAGE: 'wallet.manage',
  REWARDS_MANAGE: 'rewards.manage',
  BILLING_MANAGE: 'billing.manage',
  VERIFICATION_MANAGE: 'verification.manage',
  RBAC_MANAGE: 'rbac.manage'
} as const;

export const PERMISSION_CATALOG = [
  [PERMISSIONS.DASHBOARD_READ, 'Consulter le tableau de bord administratif.'],
  [PERMISSIONS.REPORTS_READ, 'Consulter la file de signalements.'],
  [PERMISSIONS.REPORTS_RESOLVE, 'Résoudre ou rejeter les signalements.'],
  [PERMISSIONS.AUDIT_READ, 'Consulter les journaux d’audit.'],
  [PERMISSIONS.USER_SUSPENSION_MANAGE, 'Suspendre et restaurer les comptes.'],
  [PERMISSIONS.FEATURE_FLAGS_MANAGE, 'Gérer les déploiements par feature flags.'],
  [PERMISSIONS.ENTITLEMENTS_MANAGE, 'Accorder et révoquer les droits exclusifs.'],
  [PERMISSIONS.STAFF_MANAGE, 'Gérer les comptes officiels Équipe KnowMe.'],
  [PERMISSIONS.WALLET_MANAGE, 'Ajuster et auditer les portefeuilles KnowCoins.'],
  [PERMISSIONS.REWARDS_MANAGE, 'Gérer les politiques et événements de récompense.'],
  [PERMISSIONS.BILLING_MANAGE, 'Gérer les plans, prix et abonnements vérifiés.'],
  [PERMISSIONS.VERIFICATION_MANAGE, 'Examiner et révoquer les identités vérifiées.'],
  [PERMISSIONS.RBAC_MANAGE, 'Attribuer et révoquer les rôles d’accès.']
] as const;

const ALL_PERMISSIONS = PERMISSION_CATALOG.map(([key]) => key);

export const SYSTEM_ROLES = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Contrôle total de la plateforme KnowMe.',
    permissions: ALL_PERMISSIONS
  },
  {
    key: 'administrator',
    name: 'Administrator',
    description: 'Administration opérationnelle complète.',
    permissions: ALL_PERMISSIONS
  },
  {
    key: 'moderator',
    name: 'Moderator',
    description: 'Modération des contenus et sécurité des utilisateurs.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_RESOLVE,
      PERMISSIONS.USER_SUSPENSION_MANAGE,
      PERMISSIONS.VERIFICATION_MANAGE
    ]
  },
  {
    key: 'support',
    name: 'Support',
    description: 'Assistance et diagnostic sans pouvoir de modification sensible.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.AUDIT_READ
    ]
  },
  {
    key: 'developer',
    name: 'Developer',
    description: 'Déploiements techniques et diagnostic contrôlé.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.FEATURE_FLAGS_MANAGE
    ]
  },
  {
    key: 'community_manager',
    name: 'Community Manager',
    description: 'Suivi communautaire et lecture des signalements.',
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.REPORTS_READ
    ]
  }
] as const;

export const STAFF_ROLE_TO_ACCESS_ROLE: Record<string, string> = {
  OWNER: 'owner',
  ADMINISTRATOR: 'administrator',
  MODERATOR: 'moderator',
  SUPPORT: 'support',
  DEVELOPER: 'developer',
  COMMUNITY_MANAGER: 'community_manager'
};
