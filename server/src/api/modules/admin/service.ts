// =============================================
// RosaeFinity — Admin Service
// =============================================

import { adminRepository } from './repository.js';

export const adminService = {
  async getDashboard() {
    return adminRepository.getDashboardStats();
  },

  async getUsers(page = 1, limit = 20) {
    return adminRepository.getUsers(page, limit);
  },

  async getUser(id: string) {
    return adminRepository.getUserById(id);
  },

  async getAuditLogs(page = 1, limit = 50) {
    return adminRepository.getAuditLogs(page, limit);
  },

  async getHealth() {
    return adminRepository.getHealth();
  },
};
