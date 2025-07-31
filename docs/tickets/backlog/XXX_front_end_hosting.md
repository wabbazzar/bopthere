# Ticket #002: Migrate Frontend Hosting from GitHub Pages to AWS CloudFront CDN

**Status**: PENDING
**Priority**: HIGH - Current GitHub Pages deployment limits performance and scalability for wedding guests
**Estimated Effort**: 5 points - Infrastructure migration with multiple deployment configuration changes
**Created**: 2025-01-31

## Overview
Migrate the wedding app's frontend hosting from GitHub Pages to AWS S3 + CloudFront CDN to improve performance, scalability, and provide better control over caching and content delivery for wedding guests worldwide.

## User Stories

### Primary User Story
As a wedding guest accessing the site from anywhere in the world, I want fast page load times and reliable access so that I can RSVP and interact with the wedding app without delays.

### Secondary User Stories
- As the development team, I want automated deployments to AWS so that we can maintain our CI/CD workflow
- As the couple, I want reliable hosting that can handle traffic spikes so that all guests can access the site during peak times
- As a mobile user, I want optimized content delivery so that the site loads quickly on cellular networks

## Technical Requirements

### Functional Requirements
- Maintain all existing functionality during migration
- Preserve character system and all three character perspectives
- Support custom domain (heatherandwesley.com) once DNS migration completes
- Maintain SEO and social media preview functionality
- Enable HTTPS with proper SSL certificates

### Non-Functional Requirements
- Performance: <2s load time for initial page load globally
- Compatibility: Support all existing browsers and devices
- Character theming: All assets must load correctly for each character
- User experience: Zero downtime during migration

## Implementation Plan

### Phase 1: AWS Infrastructure Setup (2 points)
**Deliverables:**
- S3 bucket configured for static website hosting
- CloudFront distribution created and configured
- IAM permissions for deployment automation

**Files to Modify:**
- None in this phase

**Files to Create:**
- `docs/aws-infrastructure.md` - Document AWS resource configuration

**Testing Requirements:**
- Verify S3 bucket is accessible
- Test CloudFront distribution with test content
- Validate IAM permissions work for deployment

### Phase 2: Build Configuration Updates (2 points)
**Deliverables:**
- Update build process to remove GitHub Pages specific configurations
- Configure proper asset paths for CDN deployment
- Update routing configuration for S3/CloudFront

**Files to Modify:**
- `vite.config.ts` - Remove base path configuration for GitHub Pages
- `package.json` - Update/add deployment scripts for AWS
- `src/App.tsx` - Remove basename from BrowserRouter if present
- `index.html` - Update any hardcoded paths if necessary

**Files to Create:**
- `.github/workflows/deploy-aws.yml` - GitHub Actions workflow for AWS deployment

**Testing Requirements:**
- Build locally and verify all assets load correctly
- Test all character perspectives and backgrounds
- Verify RSVP flow works with new paths

### Phase 3: Deployment and DNS Configuration (1 point)
**Deliverables:**
- Deploy to AWS and verify functionality
- Configure CloudFront for custom domain support
- Document DNS configuration for future Porkbun migration

**Files to Modify:**
- `README.md` - Update deployment instructions
- `CLAUDE.md` - Add AWS deployment guidelines

**Files to Create:**
- `docs/dns-configuration.md` - DNS settings for domain migration

**Testing Requirements:**
- Full site testing on CloudFront URL
- Performance testing from multiple geographic locations
- Mobile device testing on actual devices

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Update deployment section with AWS instructions
- [ ] `CLAUDE.md` - Add AWS-specific deployment guidelines

### Technical Documentation
- [ ] Create AWS infrastructure documentation
- [ ] Document GitHub Actions workflow for AWS
- [ ] Create DNS migration guide for Porkbun

### User Documentation
- [ ] Update any references to GitHub Pages URL
- [ ] Document new deployment process for team

## Success Criteria

### Functional Acceptance Criteria
- [ ] All three character perspectives load correctly with proper theming
- [ ] RSVP system functions identically to current implementation
- [ ] All background images and assets load from CloudFront
- [ ] Mobile and desktop experiences remain unchanged

### Performance Criteria
- [ ] Initial page load <2s from major geographic regions
- [ ] All assets served with proper cache headers
- [ ] 99.9% uptime as measured by CloudFront metrics

### Quality Criteria
- [ ] Zero regression in existing functionality
- [ ] Automated deployment via GitHub Actions
- [ ] CloudFormation or documented infrastructure as code
- [ ] Domain-agnostic configuration for easy DNS updates

## Dependencies

### Technical Dependencies
- AWS account with appropriate permissions
- GitHub Actions secrets for AWS credentials
- Understanding of current asset structure and paths

### Character System Dependencies
- All character-specific assets must be properly migrated
- Background images must maintain proper paths
- Character switching must work seamlessly

### Development Dependencies
- No blocking dependencies on other tickets
- Can proceed independently of domain migration

## Risks & Mitigations

### Technical Risks
**Risk**: Asset paths break during migration causing missing images/styles
**Impact**: HIGH
**Mitigation**: Thorough testing of all asset paths before switching DNS

### Character System Risks
**Risk**: Character-specific backgrounds fail to load from CDN
**Impact**: HIGH  
**Mitigation**: Test each character perspective and RSVP step thoroughly

### User Experience Risks
**Risk**: Temporary accessibility issues during migration
**Impact**: MEDIUM
**Mitigation**: Perform migration during low-traffic hours, maintain GitHub Pages as fallback

INSTRUCTIONS FOR CLAUDE:
- Completed steps marked as [COMPLETE] in Headers
- Commit with standard messaging between each phase