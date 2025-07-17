#!/bin/bash
cd /home/kavia/workspace/code-generation/interactive-faq-chatbot-4e1f77df/faq_chatbot_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

