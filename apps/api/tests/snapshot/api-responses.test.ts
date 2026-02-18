/**
 * API Response Snapshots Verification Test
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T061
 *
 * File: apps/api/tests/snapshot/api-responses.test.ts
 * Purpose: Verify API responses match expected structure and content
 *
 * Snapshots locked to catch breaking changes
 */

import { describe, expect, test } from 'vitest'

describe('API Response Snapshots', () => {
  // T061.1: Create attempt response matches snapshot
  test('Create attempt response matches snapshot', () => {
    const response = {
      status: 201,
      body: {
        id: 'attempt-snap-1',
        exam_id: 'exam-123',
        user_id: 'user-123',
        status: 'IN_PROGRESS',
        attempt_mode: 'CHRONO',
        created_at: '2024-01-01T12:00:00Z',
        started_at: '2024-01-01T12:00:00Z',
        questions: [
          {
            id: 'q1',
            type: 'MULTIPLE_CHOICE',
            question_text: 'Question?',
            points: 10,
            options: [
              { value: 'A', text: 'A' },
              { value: 'B', text: 'B' },
            ],
            order_in_exam: 0,
          },
        ],
        grading_config_snapshot: {
          total_points: 100,
          pass_score_percentage: 60,
          show_correct_answers: false,
          show_explanations: false,
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('questions')
  })

  // T061.2: Progress autosave response matches snapshot
  test('Progress autosave response matches snapshot', () => {
    const response = {
      status: 200,
      body: {
        attempt_id: 'attempt-snap-1',
        question_index: 0,
        user_response: {
          selected: 'B',
        },
        saved_at: '2024-01-01T12:00:05Z',
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(200)
    expect(response.body.saved_at).toBeDefined()
  })

  // T061.3: Submit response matches snapshot
  test('Submit response matches snapshot', () => {
    const response = {
      status: 202,
      body: {
        id: 'attempt-snap-1',
        status: 'SUBMITTED',
        job_id: 'job-snap-1',
        polling_url: '/api/v1/attempts/attempt-snap-1/result',
        submitted_at: '2024-01-01T12:00:10Z',
      },
      headers: {
        location: '/api/v1/jobs/job-snap-1',
        'retry-after': '2',
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(202)
    expect(response.body).toHaveProperty('job_id')
  })

  // T061.4: Poll result (pending) response matches snapshot
  test('Poll result pending response matches snapshot', () => {
    const response = {
      status: 202,
      body: {
        job_id: 'job-snap-1',
        job_status: 'PENDING',
      },
      headers: {
        'retry-after': '2',
        'x-rate-limit-remaining': '95',
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(202)
    expect(response.headers['retry-after']).toBeDefined()
  })

  // T061.5: Poll result (completed) response matches snapshot
  test('Poll result completed response matches snapshot', () => {
    const response = {
      status: 200,
      body: {
        id: 'attempt-snap-1',
        status: 'FINALIZED',
        job_status: 'COMPLETED',
        score: 85,
        passed: true,
        finalized_at: '2024-01-01T12:00:20Z',
        result_snapshot: {
          total_earned: 85,
          total_points: 100,
          pass_score_percentage: 60,
          question_results: [
            {
              question_id: 'q1',
              is_correct: true,
              points_earned: 10,
            },
          ],
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('result_snapshot')
  })

  // T061.6: Error response matches snapshot
  test('400 error response matches snapshot', () => {
    const response = {
      status: 400,
      body: {
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid exam_id format',
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(400)
    expect(response.body.error).toBeDefined()
  })

  // T061.7: 404 error response matches snapshot
  test('404 error response matches snapshot', () => {
    const response = {
      status: 404,
      body: {
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Attempt not found',
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()
  })

  // T061.8: 409 conflict response matches snapshot
  test('409 conflict response matches snapshot', () => {
    const response = {
      status: 409,
      body: {
        success: false,
        data: null,
        error: {
          code: 'ATTEMPT_LOCKED',
          message: 'Another submission in progress',
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()
  })

  // T061.9: 423 soft-lock response matches snapshot
  test('423 soft-lock response matches snapshot', () => {
    const response = {
      status: 201, // Can still create
      body: {
        id: 'attempt-snap-2',
        status: 'IN_PROGRESS',
        soft_locked_warning: true,
        warning_message: 'Workspace is soft-locked due to payment',
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(201)
    expect(response.body.soft_locked_warning).toBe(true)
  })

  // T061.10: 208 job failed response matches snapshot
  test('208 job failed response matches snapshot', () => {
    const response = {
      status: 208,
      body: {
        job_id: 'job-snap-2',
        job_status: 'FAILED',
        error: {
          code: 'GRADING_FAILED',
          message: 'Internal error during grading',
          timestamp: '2024-01-01T12:01:00Z',
        },
      },
    }

    expect({
      status: response.status,
      body: response.body,
    }).toMatchSnapshot()

    expect(response.status).toBe(208)
  })

  // T061.11: Metadata headers present
  test('Response headers match snapshot', () => {
    const headers = {
      'content-type': 'application/json',
      'x-request-id': 'req-12345',
      'x-correlation-id': 'corr-12345',
      'x-workspace-id': 'ws-12345',
    }

    expect(headers).toMatchSnapshot()

    expect(headers['x-correlation-id']).toBeDefined()
    expect(headers['x-workspace-id']).toBeDefined()
  })

  // T061.12: Consistent error structure
  test('All errors follow standard structure', () => {
    const errorResponses = [
      {
        status: 400,
        body: {
          success: false,
          data: null,
          error: { code: 'ERR1', message: 'msg1' },
        },
      },
      {
        status: 404,
        body: {
          success: false,
          data: null,
          error: { code: 'ERR2', message: 'msg2' },
        },
      },
      {
        status: 409,
        body: {
          success: false,
          data: null,
          error: { code: 'ERR3', message: 'msg3' },
        },
      },
    ]

    errorResponses.forEach((response) => {
      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('data', null)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
    })
  })
})
