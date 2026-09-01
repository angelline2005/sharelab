---
title: "Why social media algorithms send you posts you don’t like"
description: "Algorithms on X tend to bring you posts that contradict your values, and it happens more to Democrats than Republicans."
pubDate: 2026-08-20
tags: ["the-conversation", "science"]
translationId: "the-conversation-288792"
---

<p class="republished-from">
  <a href="https://theconversation.com" rel="noopener">
    <img src="/the-conversation-logo.svg" alt="The Conversation" height="24" />
  </a>
</p>

*By [Ziv Epstein, Postdoctoral Associate in Social and Ethical Responsibilities of Computing, Massachusetts Institute of Technology (MIT)](https://theconversation.com/profiles/ziv-epstein-1446172), [Farnaz Jahanbakhsh, Assistant Professor of Electrical Engineering and Computer Science and of Information, University of Michigan](https://theconversation.com/profiles/farnaz-jahanbakhsh-2647698), [Michael Bernstein, Professor of Computer Science, Stanford University](https://theconversation.com/profiles/michael-bernstein-340709). Originally published on [The Conversation](https://theconversation.com/why-social-media-algorithms-send-you-posts-you-dont-like-288792) under a
[Creative Commons Attribution-NoDerivatives 4.0 licence](https://creativecommons.org/licenses/by-nd/4.0/).*

Do your social media accounts feed you content that reflects your core beliefs and guiding principles? Our new research published in the Proceedings of the National Academy of Sciences shows that the algorithms supplying your feeds may be prioritizing [content that clashes with your values](https://doi.org/10.1073/pnas.2610388123). That’s because the algorithms heavily weigh online posts that you reply to, and social media users tend to more often comment on content they take issue with than content they agree with.

Notably, our study of the X social media platform shows that although the [X feed algorithm](https://github.com/xai-org/x-algorithm) promotes content to both Democratic and Republican users that contradicts their values, it does so more extensively for Democrats.

## How content gets into your feed

Social media platforms use powerful algorithms that select posts to display in your feed from a vast pool of possible content.

On X, for example, posts appear on your screen as [“For You” pages](https://help.x.com/en/using-x/x-timeline). The algorithms predict the likelihood you will engage with the content – click a “like” icon or add a comment. Then they use the accuracy of those predictions to tailor what they serve you next time. Platforms use these interactions to learn their users’ tendencies.

But will the posts you receive reflect what you actually value? Some users care most about preserving traditions or keeping society safe. Others care more about free expression or protecting the natural world. Most people care about all of those things, to different extents. A feed aligned with a person’s values would reflect those varying priorities.

Psychologists use [well-established surveys](https://i2insights.org/2022/05/10/schwartz-theory-of-basic-values/) to measure what a person values. To measure values expressed in the posts a platform selects for someone, we built [a measurement tool](https://doi.org/10.1609/icwsm.v20i1.42664) that uses standard psychological classifications of human values. We then applied it to the feeds of 715 U.S.-based users on X.

We discovered that the X feed algorithm is most likely to amplify posts about upholding tradition, following rules or keeping society safe. And it is most likely to demote posts about looking after people, concern for people far away, being dependable or protecting nature.

When we compared these values against the values users had expressed in their own posts, we found the algorithm was more likely to promote posts that conflict with users’ values than posts that align.

## Why your feed may clash with your values

Why did this trend occur? First, we checked whether users follow accounts that diverge from their values to begin with, but we determined that most accounts people follow do, in fact, align.

We also looked at whether people engage only with posts they disagree with, in which case the algorithm would just be serving up more of the same. But we found that people engage with plenty of posts that reflect values they agree with.

The catch has to do with the nature of the interactions. People primarily respond to content by “liking” it – clicking a “heart” button on X or a [“thumbs-up” button](https://en.wikipedia.org/wiki/Facebook_like_button) on Facebook. Less frequently, people will write a reply, and when they do, we find that they often reply to posts that clash with their values.

Here is the smoking gun: The X algorithm treats those rare replies as a much weightier signal than the many likes. Essentially, it learns most strongly from replies. As a result, the algorithm tends to send a user “For You” posts that reflect the values of posts they’ve commented on – which tend to clash with their own values.

## Posts to Democrats are more objectionable

Now the twist: We found that this algorithmic tendency is stronger on X for users who reported to be Democrats than those who reported to be Republicans. Our evidence indicates that this is because Democrats object more than Republicans to content they reply to. That creates a stronger feedback loop in which the algorithm more strongly presents clashing posts. The content the algorithm amplifies is more than [four times more misaligned for Democrats](https://doi.org/10.1073/pnas.2610388123) than it is for Republicans.

So what comes next? In other research, we’ve hit upon one way for social media platforms to better align feeds with users’ values. We created a way for platform designers to ask users what they value and to [then sort their feeds accordingly](https://doi.org/10.1145/3772318.3791281). We found that users are quite good at distinguishing whether sample feeds sent to them align or do not align with their values.

Aligning feeds with values may open a possible door out of echo chambers in a way that unmediated exposure to the other side does not. Recent research from our team has shown that algorithms optimized for engagement – basically handing people the opposition and leaving them to sort it out – may even be [responsible for more polarization, not less](https://doi.org/10.1126/science.adu5584). Surfacing bridging content that spans political lines while speaking to what the user values could be a promising direction for fostering both user autonomy and constructive conversation.

Ideally, in our view, the people who use a social media platform should have a greater say in the kinds of information shown to them. If platform designers, the public and policymakers can create new tools that facilitate this goal, then perhaps platforms can better support the values and actions people care about.

*Michael Bernstein receives funding from the Stanford Institute for Human-Centered Artificial Intelligence and National Science Foundation grant IIS-2403433. He also discloses a relationship as a cofounder of Simile AI, Inc., which builds AI human behavioral simulations. He was a postdoctoral scholar on the data science team at Facebook in 2012.*

*Farnaz Jahanbakhsh and Ziv Epstein do not work for, consult, own shares in or receive funding from any company or organization that would benefit from this article, and have disclosed no relevant affiliations beyond their academic appointment.*

<img src="https://counter.theconversation.com/content/288792/count.gif?distributor=republish-lite-1" alt="The Conversation" width="1" height="1" style="border:none !important;box-shadow:none !important;margin:0 !important;max-height:1px !important;max-width:1px !important;min-height:1px !important;min-width:1px !important;opacity:0 !important;outline:none !important;padding:0 !important" />
