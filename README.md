# Use Haraka as a Rails Action Mailbox ingress

In this repo, I've mushed together [mailprotector/haraka-plugin-queue-rails](https://github.com/mailprotector/haraka-plugin-queue-rails) and [instrumentisto/haraka-docker-image](https://github.com/instrumentisto/haraka-docker-image) so I can forward emails into a rails app.

You can use this image with the following ENV's (example values provided)

```
USER_AGENT=haraka
ACTION_MAILBOX_PASSWORD=superdupersecretpassword
ACTION_MAILBOX_URL=https://yourapp.com/rails/action_mailbox/relay/inbound_emails
HOSTNAME=inboundmail.yourapp.com
ACCEPT_MAIL_FOR_HOSTNAME=yourapp.com
```

See the original README's for more information
