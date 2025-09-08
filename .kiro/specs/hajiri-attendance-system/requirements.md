# Requirements Document

## Introduction

The Hajiri Attendance System is a lightweight, mobile-first attendance management solution designed for construction, agricultural, and field sites. The system enables foremen to submit daily attendance records ("Hajiri"), site incharges to review and approve submissions, and administrators to manage sites and users. The primary goal is to provide a fast, mobile-friendly workflow that ensures accurate hours calculation and maintains an auditable approval trail.

## Requirements

### Requirement 1: Worker Management

**User Story:** As an administrator or foreman, I want to create and manage worker records, so that I can track attendance for all personnel on my sites.

#### Acceptance Criteria

1. WHEN a user creates a worker record THEN the system SHALL require name and father_name fields
2. WHEN a user creates a worker record THEN the system SHALL optionally accept adhar_number and phone_number fields
3. WHEN a worker record is created THEN the system SHALL generate a unique worker_id automatically
4. WHEN an administrator accesses worker management THEN the system SHALL allow editing and removing worker records
5. IF adhar_number is provided THEN the system SHALL encrypt it at rest for privacy protection

### Requirement 2: Site and Assignment Management

**User Story:** As an administrator, I want to create sites and assign personnel to them, so that I can organize attendance tracking by location and responsibility.

#### Acceptance Criteria

1. WHEN an administrator creates a site THEN the system SHALL store site name, location, and notes
2. WHEN an administrator manages assignments THEN the system SHALL allow assigning foremen to specific sites
3. WHEN an administrator manages assignments THEN the system SHALL allow assigning site incharges to specific sites
4. WHEN site assignments are made THEN the system SHALL enforce role-based access to site data

### Requirement 3: Daily Attendance Submission

**User Story:** As a foreman, I want to submit daily attendance for workers under my supervision, so that their work hours are recorded for approval.

#### Acceptance Criteria

1. WHEN a foreman opens attendance submission THEN the system SHALL display workers assigned to their site
2. WHEN a foreman marks attendance THEN the system SHALL capture Present/Absent status at the configured checkpoint time (default 08:00)
3. WHEN a foreman enters attendance data THEN the system SHALL provide dial-style input for X (full days) and Y (additional value) per worker
4. WHEN a foreman submits attendance THEN the system SHALL set submittedToIncharge to true and verified to false
5. WHEN attendance is submitted THEN the system SHALL notify the assigned site incharge

### Requirement 4: Hours Calculation

**User Story:** As a system user, I want working hours to be calculated automatically based on attendance inputs, so that payroll calculations are accurate and consistent.

#### Acceptance Criteria

1. WHEN attendance data is entered THEN the system SHALL calculate working hours using the formula: X * P + Y (where P is configurable full-day hours, default 8)
2. WHEN site configuration allows alternate interpretation THEN the system SHALL calculate hours as: X * P + Y * (P/2) for half-day mode
3. WHEN X or Y values are modified THEN the system SHALL recalculate working hours in real-time
4. WHEN hours are calculated THEN the system SHALL display the result immediately in the UI

### Requirement 5: Review and Approval Workflow

**User Story:** As a site incharge, I want to review and approve attendance submissions, so that I can verify accuracy before finalizing records.

#### Acceptance Criteria

1. WHEN a site incharge accesses pending approvals THEN the system SHALL display all unverified submissions for their assigned sites
2. WHEN a site incharge opens an approval modal THEN the system SHALL show worker name, father's name, P/A status, and editable X/Y values
3. WHEN a site incharge modifies P/A status or X/Y values THEN the system SHALL update calculated hours in real-time
4. WHEN a site incharge approves attendance THEN the system SHALL set verified to true and record approval metadata
5. WHEN approval is completed THEN the system SHALL optionally notify relevant parties

### Requirement 6: Audit Trail and History

**User Story:** As an administrator or site incharge, I want to view historical attendance records and changes, so that I can maintain accountability and resolve disputes.

#### Acceptance Criteria

1. WHEN any attendance data is submitted or modified THEN the system SHALL create an audit record with user, timestamp, and change details
2. WHEN users access history THEN the system SHALL display chronological attendance and approval records per worker
3. WHEN audit logs are created THEN the system SHALL capture before and after values for all changes
4. WHEN data retention policies apply THEN the system SHALL maintain attendance data for the configured period (default 3 years)

### Requirement 7: User Authentication and Authorization

**User Story:** As a system administrator, I want secure role-based access control, so that users can only perform actions appropriate to their role.

#### Acceptance Criteria

1. WHEN users log in THEN the system SHALL authenticate using email/phone and password
2. WHEN user roles are enforced THEN the system SHALL allow only foremen to submit attendance
3. WHEN user roles are enforced THEN the system SHALL allow only site incharges to approve submissions
4. WHEN user roles are enforced THEN the system SHALL allow only administrators to manage global settings
5. WHEN sensitive data is stored THEN the system SHALL use TLS for transport and encryption for PII

### Requirement 8: Mobile-First User Experience

**User Story:** As a foreman or site incharge using mobile devices, I want an intuitive and fast interface, so that I can efficiently complete attendance tasks in field conditions.

#### Acceptance Criteria

1. WHEN the attendance modal loads THEN the system SHALL complete loading within 2 seconds on 2G/3G networks
2. WHEN users interact with dial inputs THEN the system SHALL provide large tap targets and clear visual feedback
3. WHEN users navigate the interface THEN the system SHALL use accessible colors, fonts, and screen-reader labels
4. WHEN foremen submit attendance for multiple workers THEN the system SHALL support bulk operations and quick multi-select
5. WHEN the interface is accessed on mobile THEN the system SHALL provide responsive design optimized for touch interaction

### Requirement 9: System Performance and Reliability

**User Story:** As a system user, I want reliable and fast system performance, so that attendance operations are not disrupted by technical issues.

#### Acceptance Criteria

1. WHEN the system is operational THEN it SHALL maintain 99.5% uptime for core submission and approval functionality
2. WHEN the system scales THEN it SHALL support up to 10,000 workers across multiple sites initially
3. WHEN security logs are maintained THEN the system SHALL retain access logs for 1 year
4. WHEN data calculations are performed THEN the system SHALL accurately process at least 1,000 attendance records
5. WHEN foremen submit attendance THEN the system SHALL complete submission for 100 workers within 60 seconds of mobile interaction