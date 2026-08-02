---
title: "Build Club Week Four: why Themis Lex exists"
published: false
description: I shipped an AI readiness self-check for California court staff. Here is the why behind it. The problem, the design choices, and what four weeks of building in public actually gave me.
tags: womenintech, civictech, buildinpublic, ai
cover_image:
canonical_url:
---

I've written a few posts about building Themis Lex. The deploy war story got the most attention. What I never did was stop and explain why the thing exists in the first place.

So before the Women in AI Accelerator wraps, here it is. Why Themis Lex. Why I built it the way I did. And what four weeks of building in public actually gave me.

## The problem

I work in California courts. I'm a Judicial Services Manager at SBSC. The data my colleagues handle every day is some of the most regulated in the state. Case parties. Witnesses. Victims. Jurors. Sealed records. Personnel files.

Every think piece this year tells court staff we should be using AI. Not one of them mentions what we actually touch.

Generic AI guidance is written for a marketing team or a software engineer. It says "redact PII" and moves on. It does not know what a Judicial Assistant does in a courtroom. It does not know that chain of custody is a legal concept with real consequences, not a best practice you can bend. It does not fit the procedural and ethical context that defines court work.

So a court employee reads the guidance, looks at their actual desk, and still has no answer to the only question that matters. Which part of my job can this help with, and which part must it never touch.

Themis Lex is the thing I wished existed when I sat down at my desk.

## What it does

Three inputs. One output. Nothing stored.

You pick your role, one of three California Superior Court classifications. You describe your workflow in your own words. You pick a data sensitivity level. Themis Lex gives you back two columns. Where AI can safely help you. Where AI must not touch your work. Every item comes with the reason behind it and a plain-language guardrail. Not "redact PII." Instead, "don't paste case numbers or party names into the AI."

The result downloads as a PDF you can hand to your supervisor.

No account. No login. No data stored. You arrive, you get your answer, you leave.

## Why I built it this way

A few choices were deliberate. They are the ones I would defend in a room.

**Stateless, on purpose.** No database. No accounts. No session storage. For a tool that asks court staff to describe their workflow, "we keep nothing" is not a missing feature. It is the feature. Trust is built into the architecture instead of promised in a policy.

**The output is the product.** Not the website. The PDF. Court work runs on paper artifacts and approvals, so Themis Lex produces something a court employee can hand to a senior judicial officer without apologizing for how it looks. It was built to belong in a courthouse.

**Real role context, not generic advice.** Under the hood, every assessment combines three things: California judicial branch AI governance principles, the actual public job description for the role you picked, and your own description of your workflow. The job description is what keeps the output from drifting generic. It tells the model what your role actually involves, so the guidance lands on your real job and not an invented one.

**Honest scope.** Three roles in version one, not thirty. The rest are visible in the tool with a clear "pending" label. I would rather ship three roles that are right than thirty that are guesses.

## What four weeks of building in public gave me

Here is the part I did not expect.

I am not a traditional engineer. I am self-taught. Two years ago I worked in jury services and could not have told you what an IAM role was. Building this alone, the technical decisions were the scariest part. Is the architecture sound. Is the output structured the right way. Am I missing something obvious that a trained engineer would catch on sight.

The Build Club community is what carried me through that. Posting every week meant I was not deciding in a vacuum. People asked the technical questions I did not know to ask myself. They helped me think through the architecture and the shape of the output. And it mattered more than I expected to hear that the project resonated with people, that the problem was real to them too.

Building in public sounds like a marketing tactic. For me it was not. The weekly check-ins kept me honest and kept me moving. The feedback made the product better. The community made the technical fear smaller.

That is what I am taking from these four weeks. Not "I shipped a tool," although the tool is real and I am proud of it. The thing I will keep is the proof that I do not have to build alone to build something worth using.

## Try it

Themis Lex is live at [themislex.org](https://themislex.org). If you work in or near a court, pick your role and run it. If you don't, run it anyway and tell me where the logic breaks.

One honest note to set expectations. This is a proof-of-concept MVP, not a finished product. Three roles, one court's job descriptions, a single model call. It does the core thing well and it stops there on purpose. I would rather you meet it as what it is than have me oversell what it isn't. Feedback is welcome, the critical kind most of all.

---

*Built solo for the Women in AI Accelerator with [Build Club](https://buildclub.ai/). Thanks to [Annie Liao](https://www.linkedin.com/in/annieliaoo/) and [Caroline Ciaramitaro](https://www.linkedin.com/in/carolineciaramitaro/), who run a community that is generous with its time and sharp with its feedback. And thanks to my wife, who kept asking "are you almost done" with exactly the right amount of love.*

*AI assisted. Human approved. Powered by NLP.*
