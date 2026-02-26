# Zidney Master Specification Index

This document defines the complete execution roadmap.

Stage numbering is global and sequential.
No stage resets across phases.

---

## PHASE 1 — PLATFORM FOUNDATION

Directory: 01_PLATFORM_FOUNDATION/

01 — Monorepo Setup  
02 — Multi-Tenancy Architecture  
03 — Authentication System  
04 — License Engine  
05 — Tenant Provisioning Service  
06 — Attempt Engine Foundation  
07 — Observability Baseline  
08 — Rate Limiting & Security

STAGE_TEST_01 — Platform Foundation Validation

---

## PHASE 2 — PLATFORM MMC

Directory: 02_PLATFORM_MMC/

09 — Products  
10 — Licenses  
11 — License Lifecycle  
12 — Provisioning Trigger  
13 — Affiliates  
14 — MMC Members  
15 — MMC Dashboard  
16 — Shared UI System

### MMC UI STAGES

UI-02-01 — MMC Shell Integration  
UI-02-02 — Products UI  
UI-02-03 — Affiliates UI  
UI-02-04 — Licenses UI  
UI-02-05 — MMC Dashboard UI  
UI-02-06 — MMC Members UI  
UI-02-07 — Provisioning Monitoring UI

STAGE_TEST_01 — MMC System Validation

---

## PHASE 3 — BACKOFFICE CORE

Directory: 03_BACKOFFICE_CORE/

### FOUNDATION

17 — Tenant Bootstrap  
18 — Workspace Settings  
19 — Translation System  
20 — Status Workflow Engine  
21 — Role Permission System

### ACADEMIC STRUCTURE

22 — Divisions  
23 — Departments  
24 — Groups  
25 — Hierarchy Tree  
26 — Teams  
27 — Semesters  
28 — Subjects  
29 — Lessons

### CONTENT CLASSIFICATION

30 — Categories  
31 — Category Values  
32 — Tags  
33 — MCQ Baskets

### EXAM ENGINE CORE

34 — MCQ Question Model  
35 — Traditional Question Model  
36 — MCQ Exam Config  
37 — Traditional Exam Config  
38 — Scheduled Engine  
39 — Auto Selection Engine  
40 — Grading Core

### USER MANAGEMENT

41 — Staff Management  
42 — Student Management  
43 — Limit Enforcement

### COMMERCIAL LAYER

44 — Plans & Subscriptions  
45 — Promocodes  
46 — Billing & Invoices

### MEDIA

47 — Media Library

### COMMUNICATION

48 — Notifications Engine  
49 — Feedback System  
50 — System Feedback

### ADS

51 — Ads Engine

### DASHBOARD

52 — Backoffice Dashboard

### BACKOFFICE UI STAGES

UI-03-01 — Backoffice Shell  
UI-03-02 — Academic Structure UI  
UI-03-03 — Exam Management UI  
UI-03-04 — User Management UI  
UI-03-05 — Commercial Layer UI  
UI-03-06 — Media Library UI  
UI-03-07 — Communication UI  
UI-03-08 — Backoffice Dashboard UI

STAGE_TEST_01 — Backoffice System Validation

---

## PHASE 4 — RUNTIME

Directory: 04_RUNTIME/

53 — Attempt Schema  
54 — Attempt Start Flow  
55 — Answer Autosave  
56 — Submission Flow  
57 — Reconnection Logic  
58 — Concurrency Guards

STAGE_TEST_01 — Runtime System Validation

---

## PHASE 5 — FRONTOFFICE RUNTIME

Directory: 05_FRONTOFFICE_RUNTIME/

59 — Frontoffice Auth  
60 — Subscription Enforcement  
61 — Content Visibility Rules  
62 — Dashboard Aggregation  
63 — Library Runtime  
64 — Live Session Runtime  
65 — Notification System  
66 — Ads Runtime  
67 — Results & Certificates

### FRONTOFFICE UI STAGES

UI-05-01 — Frontoffice Shell  
UI-05-02 — Student Auth UI  
UI-05-03 — Dashboard UI  
UI-05-04 — Library UI  
UI-05-05 — Attempt Runtime UI  
UI-05-06 — Results & Certificates UI  
UI-05-07 — Subscription & Access Gates UI  
UI-05-08 — Notifications UI  
UI-05-09 — Live Sessions UI  
UI-05-10 — Ads Runtime UI

STAGE_TEST_01 — Frontoffice System Validation

---

## PHASE 6 — UI APPLICATION RUNTIME

Directory: 06_UI_APPLICATION_RUNTIME/

UI-00 — Runtime Architecture  
UI-01 — Auth Module  
UI-02 — API Client Layer  
UI-03 — Router & Guards  
UI-04 — Global Error Handling  
UI-05 — Environment Configuration  
UI-06 — State Management  
UI-07 — Layout System Integration  
UI-08 — Notification & Feedback  
UI-09 — Security & Token Handling

STAGE_TEST_01 — UI Runtime Validation

---

## Execution Rule

A stage cannot begin unless:

- All previous stages are complete.
- Migration impact reviewed.
- Observability integrated.
- Permission rules enforced.
- Tests passing.
