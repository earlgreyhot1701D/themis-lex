---
title: "Build Club Week Three: the deploy logs don't catch everything"
published: false
description: I didn't post last week. Themis Lex hit six walls on the way to a live URL. Here's what the deploy logs didn't tell me, and what I'm carrying into the final submission on Wednesday.
tags: buildinpublic, womenintech, aws, civictech
cover_image:
canonical_url:
---

I didn't post last week. Here's why.

Week two closed with me forecasting that week three would be "polish and deployment to a live URL." The polish part went well. Loading state for the latency. Brand banner in the PDF. Mobile responsiveness. All clean. All on the punchlist, all checked off.

Then deployment started.

The first time my deployed app failed, it failed silently. The API request hung for exactly 28 seconds and then died. CloudWatch had no record of the call. My code logged nothing. The browser said 504 and gave up.

I tried again. 28 seconds. Tried again. 28 seconds.

If you're self-taught, you know this moment. The one where the deploy is broken and the system isn't telling you why, and you start wondering if you should have been doing this at all.

I sat in that moment longer than I want to admit.

It turned out my code was fine. The wall was AWS Amplify Hosting plus Bedrock, in production, where the quickstart docs end.

The first wall was a trust policy that named only one principal where two were required. The second was a role attached at the wrong level, app instead of branch. The third was environment variables that worked at build time but vanished at runtime. The fourth was a permission Bedrock needed from AWS Marketplace that nobody told the IAM policy writers about. The fifth was a 28-second platform timeout that couldn't be raised. The sixth was a streaming workaround that didn't actually stream because Next.js Pages API routes buffer responses.

Each wall presented the same way. Silent 28-second hang, no error from my code. Each one had a different underlying cause. Every cause was documented somewhere, in an open GitHub issue, a scattered Stack Overflow answer, or a doc the quickstart never linked to.

The pattern of "set this up the way the quickstart says, then watch it fail silently for one of six reasons" is well-trodden ground. The quickstart does not mention any of it.

The fix in the end was small. I swapped my model from Claude Sonnet 4.6 (about 42 seconds to generate my output) to Claude Haiku 4.5 (about 14 seconds). Same prompt, slightly less verbose output, fits inside the platform window. One constant changed. Deploy worked.

In Week Two I wrote that the PRD doesn't catch everything, and the punchlist does the rest. In Week Three I learned that the deploy logs don't catch everything either. There is a whole class of failures that don't produce errors. They produce silence. The silence is its own kind of error, and you have to learn to read it.

The six walls I hit are now in my repo as a six-gotcha README section. They are also in a captured-knowledge Claude skill so the next time I or anyone using Claude with my skill hits one of them, the day-long detour can be a fifteen-minute fix.

That feels like the most Build Club thing I have done in four weeks. Not "I shipped a tool." Other people ship tools. What I did is write down where the wall is so the next person doesn't lose their Sunday night to it.

Themis Lex is live at themislex.org. Court staff in my own building can use it tomorrow if they want to. The PDF works. The fonts loaded. The banner rendered.

Final submission is Wednesday. The Women in AI Accelerator wraps. I will probably not place because I am one of 150+ builders shipping real products and the field is strong. That's not the point. The point is that two years ago I worked in jury services and didn't know what an IAM role was. This week I diagnosed an AWS gateway timeout, swapped foundation models, and shipped a working LLM app for court staff before my deadline.

Two years.

I'll post on Wednesday with the submission and what I'm taking from the four weeks.

---

*Building alongside [Build Club](https://buildclub.ai/) in the Women in AI Accelerator. Tagging [Annie Liao](https://www.linkedin.com/in/annieliaoo/) and [Caroline Ciaramitaro](https://www.linkedin.com/in/carolineciaramitaro/) who run a thoughtful, generous community. Thanks also to my wife, who kept asking "are you almost done" with the exact right amount of love.*

*#WomenInAI #BuildClub #WomenWhoCode #AI*
