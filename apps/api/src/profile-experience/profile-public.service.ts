import { Injectable } from '@nestjs/common';
import { sanitizePublicProfileSnapshot } from './profile-public-privacy';
import { ProfileExperienceService } from './profile-experience.service';

@Injectable()
export class ProfilePublicService {
  constructor(private readonly profiles: ProfileExperienceService) {}

  async snapshot(username: string, viewerId: string | null) {
    const snapshot = await this.profiles.publicSnapshot(username, viewerId);
    return sanitizePublicProfileSnapshot(snapshot);
  }
}
