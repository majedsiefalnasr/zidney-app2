# Zidney Stage Dependency Map

This document defines stage execution dependencies.

A stage must NOT begin unless all dependencies are complete.

This protects:

- Data integrity
- Tenant isolation
- Runtime stability
- Migration safety
- AI correctness

---

## PHASE 1 — PLATFORM FOUNDATION

01 — Monorepo Setup  
Dependencies: none

02 — Multi-Tenancy Architecture  
Dependencies: 01

03 — Authentication System  
Dependencies: 02

04 — License Engine  
Dependencies: 02

05 — Tenant Provisioning Service  
Dependencies: 04

06 — Attempt Engine Foundation  
Dependencies: 02, 03

07 — Observability Baseline  
Dependencies: 01

08 — Rate Limiting & Security  
Dependencies: 03, 07

---

## PHASE 2 — PLATFORM MMC

09 — Products  
Dependencies: 04

10 — Licenses  
Dependencies: 09

11 — License Lifecycle  
Dependencies: 10

12 — Provisioning Trigger  
Dependencies: 10, 05

13 — Affiliates  
Dependencies: 10

14 — MMC Members  
Dependencies: 03

15 — MMC Dashboard  
Dependencies: 10

16 — Shared UI System  
Dependencies: 01

---

## PHASE 3 — BACKOFFICE CORE

### FOUNDATION

17 — Tenant Bootstrap  
Dependencies: 05

18 — Workspace Settings  
Dependencies: 17

19 — Translation System  
Dependencies: 18

20 — Status Workflow Engine  
Dependencies: 21, 18

21 — Role Permission System  
Dependencies: 03

---

### ACADEMIC STRUCTURE

22 — Divisions  
Dependencies: 18

23 — Departments  
Dependencies: 22

24 — Groups  
Dependencies: 23

25 — Hierarchy Tree  
Dependencies: 21

26 — Teams  
Dependencies: 21

27 — Semesters  
Dependencies: 22

28 — Subjects  
Dependencies: 22

29 — Lessons  
Dependencies: 28

---

### CONTENT CLASSIFICATION

30 — Categories  
Dependencies: 22

31 — Category Values  
Dependencies: 30

32 — Tags  
Dependencies: 22

33 — MCQ Baskets  
Dependencies: 22

---

### EXAM ENGINE CORE

34 — MCQ Question Model  
Dependencies: 28, 33

35 — Traditional Question Model  
Dependencies: 28

36 — MCQ Exam Config  
Dependencies: 34, 22

37 — Traditional Exam Config  
Dependencies: 35, 22

38 — Scheduled Engine  
Dependencies: 36, 37, 22

39 — Auto Selection Engine  
Dependencies: 34, 30, 31, 32, 33, 22

40 — Grading Core  
Dependencies: 34, 35

---

### USER MANAGEMENT

41 — Staff Management  
Dependencies: 21

42 — Student Management  
Dependencies: 22

43 — Limit Enforcement  
Dependencies: 42

---

### COMMERCIAL LAYER

44 — Plans & Subscriptions  
Dependencies: 42

45 — Promocodes  
Dependencies: 44

46 — Billing & Invoices  
Dependencies: 44

---

### MEDIA

47 — Media Library  
Dependencies: 18

---

### COMMUNICATION

48 — Notifications Engine  
Dependencies: 21

49 — Feedback System  
Dependencies: 42

50 — System Feedback  
Dependencies: 42

---

### ADS

51 — Ads Engine  
Dependencies: 42

---

### DASHBOARD

52 — Backoffice Dashboard  
Dependencies: Phase 3 complete

---

## PHASE 4 — RUNTIME

53 — Attempt Schema  
Dependencies: 06, 40

54 — Attempt Start Flow  
Dependencies: 53

55 — Answer Autosave  
Dependencies: 54

56 — Submission Flow  
Dependencies: 55

57 — Reconnection Logic  
Dependencies: 54

58 — Concurrency Guards  
Dependencies: 53, 54

---

## PHASE 5 — FRONTOFFICE RUNTIME

59 — Frontoffice Auth  
Dependencies: 03

60 — Subscription Enforcement  
Dependencies: 44, 59

61 — Content Visibility Rules  
Dependencies: 42, 22

62 — Dashboard Aggregation  
Dependencies: 54, 59, 60

63 — Library Runtime  
Dependencies: 47, 60

64 — Live Session Runtime  
Dependencies: 22, 60

65 — Notification System  
Dependencies: 48

66 — Ads Runtime  
Dependencies: 51

67 — Results & Certificates  
Dependencies: 40, 60
