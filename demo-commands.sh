# Service Info
curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/service-info'

# For sigv4 signed requests, need to use a newer version of curl than the default MacOS distribution

# Replace API ID and run/task ID's

# Post run
/usr/local/opt/curl/bin/curl -X POST 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}" --header "content-type:application/json" -d '{"workflow_type":"NEXTFLOW","workflow_url":"omics://workflow/2737728","workflow_params":{"addressee":"Andrew","greeting":"Hello"},"tags":{"type":"demo"}}'

# List runs
/usr/local/opt/curl/bin/curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}" 

# View run details
/usr/local/opt/curl/bin/curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs/9475299' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}"

# Get run status
/usr/local/opt/curl/bin/curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs/9475299/status' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}"

# List tasks for the run
/usr/local/opt/curl/bin/curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs/9846942/tasks' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}"

# List specific task details
/usr/local/opt/curl/bin/curl 'https://ji3vdkroz7.execute-api.us-east-1.amazonaws.com/prod/runs/9846942/tasks/4567884' --aws-sigv4 aws:amz:us-east-1:execute-api --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" --header "x-amz-security-token: ${AWS_SESSION_TOKEN}"
