---
title: "I Built an AI Tool for Court Staff. AWS Took Six Tries to Let Me Deploy It."
published: false
description: A deployment war story for the plain-language people in the back. Six AWS Amplify gotchas, one full day of debugging, one working LLM app shipped before the hackathon deadline.
tags: devchallenge, aws, learning, womenintech
cover_image:
canonical_url:
---

I opened CloudWatch for the fourth time.

The Lambda log group was empty. The Bedrock log group was empty. My browser said 28 seconds, then 504 Gateway Timeout. My code said nothing.

I had spent the morning fixing what I thought was the problem. The problem had not been fixed.

## What I was building

Themis Lex is an AI readiness self-check for California Superior Court staff. I work in courts. I am a Judicial Services Manager at Santa Barbara Superior Court, and the data my colleagues handle every day is some of the most regulated in the state. Case parties. Witnesses. Victims. Jurors. Sealed records. Personnel files.

None of the generic AI guidance available right now addresses any of that.

Themis Lex is the thing I wished existed when I sat down at my desk. A court employee enters their role, describes their workflow, picks a data sensitivity level, and gets back two columns. Where AI can safely help. Where AI must not touch. The output downloads as a PDF the employee can hand to their supervisor.

I built it solo in three weeks for the Women in AI Accelerator. The submission deadline was Wednesday. I was deploying on Sunday night.

## The first wall

I had set up my AWS infrastructure correctly. I knew this because I had written a tight IAM policy by hand, with the minimum permissions needed to call Claude via Bedrock. I had attached it to a role. The role had the right trust policy. The trust policy named `amplify.amazonaws.com` as the service allowed to use it.

The deployed app would not call Bedrock. Every API request hung for exactly 28 seconds and then died.

I tried again. 28 seconds. Tried again. 28 seconds.

I learned the exact 28-second silence the way you learn a song you can't get out of your head.

CloudWatch had no record of the call. Nothing was logged from my code. It was as if the request to Bedrock had never reached AWS at all.

I changed the policy. Tried again. 28 seconds.

I changed the policy again. Tried again. 28 seconds.

It took me three hours to find an open issue on the AWS Amplify GitHub repo from 2023 explaining that the runtime Lambda (which serves my API routes, the thing that actually runs when a user hits my app) introduces itself to AWS as `lambda.amazonaws.com`, not `amplify.amazonaws.com`. My trust policy only named Amplify. So when the runtime Lambda asked for permission to use the role, AWS said no. Silently.

The AWS docs only show one principal. They do not mention the second one. They have not been updated to mention the second one in over two years.

I added `lambda.amazonaws.com` to my trust policy. Tried again. 28 seconds.

## The second wall

The trust policy was right. The IAM role was attached to my Amplify app. Everything looked correct in the AWS Console. But the runtime Lambda still couldn't find credentials.

I learned: Amplify has TWO places to attach the role. There is an app-level slot and a branch-level slot. The app-level slot controls the BUILD environment. The branch-level slot controls the RUNTIME environment. Only the branch-level attachment flows credentials to the live Lambda. The Default role is a lie if you assume it means default for everything.

This is not documented in the quickstart. This is also a recurring open issue.

I attached the role at the branch level. Tried again.

I got a different error. Progress.

## The third wall

The new error was about my model ID. I had set `BEDROCK_MODEL_ID` in Amplify Console under Environment Variables. I had double-checked. It was definitely there. Available during the build.

At runtime, it was undefined.

Amplify, it turns out, does not pass environment variables from the Console to the SSR Lambda runtime. They live in the build environment. They do not flow forward. Vercel does this. Railway does this. Render does this. Amplify does not.

The fix is to add a small block to `next.config.js` that captures the variable at build time and inlines it into the server bundle. Five lines of code. Not in the docs.

I added the lines. Tried again. New error.

## The fourth wall

This one was beautiful. It said `AccessDeniedException` but the action it mentioned was not Bedrock. It was `aws-marketplace`.

I had not knowingly used AWS Marketplace at any point in this project.

It turns out that since September 2025, Bedrock auto-enables foundation models on first call. The auto-enable happens silently through AWS Marketplace. Your IAM principal needs Marketplace permissions for it to succeed. The old Model access page in the Bedrock Console where you manually clicked to opt in is retired. The new system is automatic. Automatic, except that you also have to add Marketplace permissions to your IAM policy by hand, because nobody told the policy writers that the auto-enable system uses Marketplace under the hood.

I added the Marketplace actions. Tried again.

The Bedrock call succeeded. The Lambda received chunks back from Claude.

The Lambda then died at 28 seconds.

## The fifth wall

I had broken into the system. The Bedrock call was working. The credentials were correct. The model was responding. The Lambda was alive.

The Amplify gateway, the thing in front of the Lambda that handles incoming HTTP requests, has a hard 28-second timeout that cannot be raised. There is no setting in the console. There is no AWS CLI flag. There is an open GitHub issue from January 2023 with 59 thumbs up and no fix.

My code calls Claude Sonnet 4.6 and asks it for two arrays of three to five workflows each, with multiple fields per workflow. The full response takes about 42 seconds to generate.

42 is bigger than 28.

I tried switching to a streaming SDK call so the Lambda would keep the connection alive as bytes flowed in. The streaming call worked perfectly from the Lambda's perspective. I could see the chunks arriving in CloudWatch.

The gateway still killed the connection at 28 seconds.

It turns out that even with streaming, Next.js Pages API routes (the kind I had built) buffer the response. They do not flush bytes to the gateway in real time. They wait until the response is complete, then send the whole thing. By which point the gateway has been waiting too long and given up.

This is also not documented in any Amplify quickstart.

## The sixth wall, which was not really a wall

I gave up on the platform. I did not move my project to a different host. I did not refactor the architecture. I did something boring.

I switched the model.

Claude Sonnet 4.6 takes about 42 seconds to generate my structured output. Claude Haiku 4.5 takes about 14 seconds. The output quality is slightly lower. The structure is identical. Both fit my schema.

I changed one constant in my code. I deployed.

The app worked. The PDF generated. The fonts loaded. The banner rendered.

## What I actually learned

Not "use a different host." Not "AWS is bad." Not "I should have known."

I learned that documentation gaps are real and they are not your fault.

The six walls I hit are all known. They are filed as issues on the AWS Amplify repo. They are documented in scattered Stack Overflow answers and AWS forum posts. Every single one of them has been hit by another developer before me, often multiple times. The pattern of "set this up the way the quickstart says, then watch it fail silently for one of six reasons" is well-trodden ground.

The quickstart does not mention any of them.

This is not because AWS is trying to make us suffer. It is because the quickstart documents the happy path. The people writing the quickstart do not deploy the way real builders deploy. They do not call large LLMs from SSR routes with structured outputs. They do not use the actual edges of the platform. They use the demo path.

Most of my Sunday night was not me being bad at this. It was me hitting the actual edges of Amplify Hosting plus Bedrock, in production, where the docs end.

I do not feel less qualified. I feel more qualified. I now know exactly where this platform breaks and how to fix it. I wrote it down. I put it in my repo as a six-gotcha README section. I built a captured-knowledge skill so the next time I (or anyone using Claude with my skill installed) sets up an Amplify app with Bedrock, the day-long detour can be a fifteen-minute fix.

## What I keep coming back to

I shipped. Themis Lex is live on the internet. Court staff in my own building, my actual colleagues, can use it on Monday if they want to. The PDF works. The fonts loaded. The banner rendered.

It is not perfect. It uses Haiku instead of Sonnet because my deadline did not give me time to move to a different host. It runs on a TLD I almost did not buy because I felt cheap. It has a watermark on the demo video because I refused to pay $29 for one month of HeyGen.

But it exists. It is in production. It is doing the thing I built it to do.

That is the line that has been running in my head since I deployed. Two years ago I worked in jury services. I did not know what an IAM role was. I had never seen a CloudWatch log. I could not have told you what SSR meant. This weekend I diagnosed an AWS gateway timeout, swapped foundation models on a Bedrock call, and shipped a working LLM app for court staff before my submission deadline.

Two years.

The walls are real. They are also small.

---

*Themis Lex is an AI readiness self-check for California Superior Court staff, built solo over three weeks for the Women in AI Accelerator (Spring 2026 Build Challenge). Live at [themislex.org](https://themislex.org). The full deployment war story, the six-gotcha README, and the captured-knowledge Claude skill all live in the [repo](https://github.com/earlgreyhot1701D/themis-lex). Thanks to Annie and Caroline at Build Club for the structural advice and the running encouragement. Thanks also to my wife, who kept asking, "are you almost done" with the exact right amount of love.*

*AI assisted. Human approved. Powered by NLP.*
