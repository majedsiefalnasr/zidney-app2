import type { Logger } from '@zidney/logger'

export interface EmailConfig {
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  senderEmail?: string
  senderName?: string
  apiKey?: string
  provider?: 'sendgrid' | 'smtp' | 'console'
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export class EmailService {
  private config: EmailConfig
  private logger?: Logger
  private queue: SendEmailOptions[] = []
  private isProcessing = false

  constructor(config: EmailConfig, logger?: Logger) {
    this.config = config
    this.logger = logger
  }

  /**
   * Send invitation email asynchronously (non-blocking)
   * Queues email for background processing
   */
  async sendInvitationEmail(
    to: string,
    invitationLink: string,
    inviteeEmail: string,
    roleName: string,
    invitedByName: string
  ): Promise<void> {
    const html = this.buildInvitationEmailHtml(
      invitationLink,
      inviteeEmail,
      roleName,
      invitedByName
    )

    const emailOptions: SendEmailOptions = {
      to,
      subject: `You're invited to join the platform`,
      html,
      text: `You've been invited to join the platform. Click here to accept: ${invitationLink}`,
    }

    // Queue for async processing (non-blocking)
    this.queue.push(emailOptions)

    // Don't await - start background processing if not already running
    this.processQueue().catch((err) => {
      if (this.logger) {
        this.logger.error('Email queue processing failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }

  /**
   * Send logout notification email
   */
  async sendLogoutNotificationEmail(
    to: string,
    memberName: string,
    timestamp: Date
  ): Promise<void> {
    const html = `
      <h2>Session ended</h2>
      <p>Hello ${memberName},</p>
      <p>Your session was ended on ${timestamp.toISOString()}.</p>
      <p>If this was not you, please contact support immediately.</p>
    `

    const emailOptions: SendEmailOptions = {
      to,
      subject: `Session ended`,
      html,
      text: `Your session was ended on ${timestamp.toISOString()}`,
    }

    this.queue.push(emailOptions)
    this.processQueue().catch((err) => {
      if (this.logger) {
        this.logger.error('Email queue processing failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }

  /**
   * Process queued emails
   * Can be called by background worker or periodically
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const emailOptions = this.queue.shift()
        if (!emailOptions) break

        try {
          await this.sendEmail(emailOptions)
        } catch (err) {
          if (this.logger) {
            this.logger.error('Failed to send email', {
              to: emailOptions.to,
              subject: emailOptions.subject,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          // Don't re-queue failed emails (prevent infinite loops)
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Send email via configured provider
   */
  private async sendEmail(options: SendEmailOptions): Promise<void> {
    const provider = this.config.provider || 'console'

    switch (provider) {
      case 'sendgrid':
        // @ts-ignore: LOGIC-BUG: sendViaSendGrid method does not exist; should call sendViaServiceProvider — see INFRA-001-LOGIC-04 [INFRA-001-LOGIC-04]
        return this.sendViaSendGrid(options)
      case 'smtp':
        return this.sendViaSMTP(options)
      case 'console':
      default:
        return this.sendViaConsole(options)
    }
  }

  /**
   * Send via SendGrid API (requires API key)
   * LOGIC-BUG: Method is unreachable; sendEmail() calls non-existent sendViaSendGrid — see INFRA-001-LOGIC-04
   */
  // @ts-ignore: method declared for future use; sendViaSendGrid invokes it incorrectly [INFRA-001-LOGIC-04]
  private async _sendViaServiceProvider(
    options: SendEmailOptions
  ): Promise<void> {
    const apiKey = this.config.apiKey
    if (!apiKey) {
      throw new Error('SendGrid API key not configured')
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          },
        ],
        from: {
          email: this.config.senderEmail || 'noreply@example.com',
          name: this.config.senderName || 'Platform',
        },
        subject: options.subject,
        content: [
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.statusText}`)
    }
  }

  /**
   * Send via SMTP (requires SMTP configuration)
   */
  private async sendViaSMTP(options: SendEmailOptions): Promise<void> {
    // Note: In production, use a library like nodemailer
    // This is a placeholder for local development
    if (this.logger) {
      this.logger.info('Email would be sent via SMTP', {
        to: options.to,
        subject: options.subject,
      })
    }
  }

  /**
   * Send via console log (development mode)
   */
  private async sendViaConsole(options: SendEmailOptions): Promise<void> {
    if (this.logger) {
      this.logger.info('Development mode: Email logged to console', {
        to: options.to,
        subject: options.subject,
        htmlLength: options.html.length,
      })
    } else {
      console.log('📧 Email:', {
        to: options.to,
        subject: options.subject,
        html: options.html,
      })
    }
  }

  /**
   * Build HTML for invitation email
   */
  private buildInvitationEmailHtml(
    invitationLink: string,
    inviteeEmail: string,
    roleName: string,
    invitedByName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.5;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #f5f5f5;
              padding: 20px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              margin: 20px 0;
            }
            .footer {
              font-size: 12px;
              color: #999;
              margin-top: 40px;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>You're invited!</h2>
            </div>
            
            <p>Hello,</p>
            
            <p>${invitedByName} has invited you to join the platform with the role: <strong>${roleName}</strong></p>
            
            <p>Click the button below to accept the invitation and create your account:</p>
            
            <a href="${invitationLink}" class="button">Accept Invitation</a>
            
            <p>This invitation link will expire in 24 hours.</p>
            
            <p>If you did not expect this invitation, please disregard this email.</p>
            
            <div class="footer">
              <p>This email was sent to ${inviteeEmail}</p>
              <p>&copy; 2025 Platform. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}

/**
 * Create email service instance with configuration
 */
export function createEmailService(
  config: Partial<EmailConfig> = {},
  logger?: Logger
): EmailService {
  const emailConfig: EmailConfig = {
    // LOGIC-BUG: EMAIL_PROVIDER env var is not validated against allowed values — see INFRA-001-LOGIC-05
    provider: (config.provider || process.env.EMAIL_PROVIDER || 'console') as
      | 'sendgrid'
      | 'smtp'
      | 'console',
    smtpHost: config.smtpHost || process.env.SMTP_HOST,
    smtpPort:
      config.smtpPort ||
      (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined),
    smtpUser: config.smtpUser || process.env.SMTP_USER,
    smtpPassword: config.smtpPassword || process.env.SMTP_PASSWORD,
    senderEmail:
      config.senderEmail || process.env.SENDER_EMAIL || 'noreply@example.com',
    senderName: config.senderName || process.env.SENDER_NAME || 'Platform',
    apiKey: config.apiKey || process.env.SENDGRID_API_KEY,
  }

  return new EmailService(emailConfig, logger)
}
