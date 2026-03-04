#!/usr/bin/env python3
import json, sys
with open('infra-audit-report.json') as f:
    d = json.load(f)
keys = ['timestamp','gitSha','vitestConfigs','eslintConfigs','playwrightConfigs',
        'totalTestFiles','readmeAudit','skippedTests','flakyTests',
        'consolidationRisk','prettierConflictRisk']
missing = [k for k in keys if k not in d]
print('ALL_KEYS_PRESENT:', len(missing)==0)
print('missing:', missing)
print('gitSha:', d['gitSha'])
print('timestamp:', d['timestamp'])
print('consolidationRisk:', d['consolidationRisk'])
print('prettierConflictRisk:', d['prettierConflictRisk'])
print('vitestConfigs:', len(d['vitestConfigs']))
print('eslintConfigs:', len(d['eslintConfigs']))
print('playwrightConfigs:', len(d['playwrightConfigs']))
print('skippedTests.count:', d['skippedTests']['count'])
print('skippedTests.detectionMethod:', d['skippedTests']['detectionMethod'])
print('flakyTests.count:', d['flakyTests']['count'])
print('readmeAudit count:', len(d['readmeAudit']))
print('totalTestFiles:', d['totalTestFiles'])
for r in d['readmeAudit']:
    print(f"  README: {r['directory']} hasReadme={r['hasReadme']} status={r['status']}")
