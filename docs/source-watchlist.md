# Pages to watch

Generated offline from `data/provider-sources.json` by `node scripts/generate.mjs`. Every family has a watchlist. The build never visits these pages. The numbers will not announce themselves.

The audit traverses every page of each configured Hugging Face model inventory. Webpages are watched at the listed URLs; this is not a recursive crawl of an entire company website. It records named links, earlier versions, unnumbered repositories, and source failures. GitHub pages provide model cards, dated news, and links; SDK tags are not model versions.

Run `node scripts/audit-releases.mjs` to capture sources and build the review report. Run `node scripts/audit-releases.mjs --offline` to replay it without network access. `--family gemma,intellect --providers-only` narrows either run; `--snapshot FILE` preserves separate captures. Live captures can change; offline replay is deterministic.

Announcement, API availability, and weights publication require separate dated evidence. A Hugging Face link shows where weights are now, not when a hosted endpoint or announcement launched. Inventory creation/modified timestamps are never release dates.

Quantizations and format conversions remain visible as excluded artifacts in inventory reports, but never count as separate releases or missing model versions.

Shared discovery catalogs: [LLM Timeline](https://llm-timeline.com/), [LLM Releases](https://www.llm-releases.com/), [LLM Gateway](https://llmgateway.io/timeline), [LLM Stats](https://llm-stats.com/llm-updates), [Opper](https://opper.ai/model-releases), [OpenRouter](https://openrouter.ai/models), [Artificial Analysis](https://artificialanalysis.ai/models). Confirm candidates against publisher evidence. OpenRouter creation dates are gateway listing dates. No prices or capability scores are imported.

<a id="gpt"></a>
## GPT

OpenAI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models) | Model documentation and release history | announcement, api |
| [openai on Hugging Face](https://huggingface.co/openai/models) | Publisher model inventory (all pages) | weights |
| [openai.com/news/](https://openai.com/news/) | Publisher announcements and release history | announcement, api |
| [developers.openai.com/api/docs/changelog](https://developers.openai.com/api/docs/changelog) | Publisher announcements and release history | announcement, api |
| [github.com/openai/gpt-oss](https://github.com/openai/gpt-oss) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="claude"></a>
## Claude

Anthropic

| Page | Watch for | Evidence |
| --- | --- | --- |
| [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) | Model documentation and release history | announcement, api |
| [www.anthropic.com/news](https://www.anthropic.com/news) | Publisher announcements and release history | announcement, api |
| [platform.claude.com/docs/en/release-notes/overview](https://platform.claude.com/docs/en/release-notes/overview) | Publisher announcements and release history | announcement, api |
| [github.com/anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="gemini"></a>
## Gemini

Google DeepMind

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) | Model documentation and release history | announcement, api |
| [ai.google.dev/gemini-api/docs/changelog](https://ai.google.dev/gemini-api/docs/changelog) | Publisher announcements and release history | announcement, api |
| [blog.google/technology/ai/](https://blog.google/technology/ai/) | Publisher announcements and release history | announcement, api |
| [github.com/google-gemini/cookbook](https://github.com/google-gemini/cookbook) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="grok"></a>
## Grok

xAI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [docs.x.ai/developers/models](https://docs.x.ai/developers/models) | Model documentation and release history | announcement, api |
| [xai-org on Hugging Face](https://huggingface.co/xai-org/models) | Publisher model inventory (all pages) | weights |
| [x.ai/news](https://x.ai/news) | Publisher announcements and release history | announcement, api |
| [github.com/xai-org/grok-1](https://github.com/xai-org/grok-1) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="llama"></a>
## Llama

Meta

| Page | Watch for | Evidence |
| --- | --- | --- |
| [meta-llama on Hugging Face](https://huggingface.co/meta-llama/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.llama.com/](https://www.llama.com/) | Publisher announcements and release history | announcement, api |
| [github.com/meta-llama/llama-models](https://github.com/meta-llama/llama-models) | Official code, model cards, and release links | announcement, weights |
| [github.com/meta-llama/PurpleLlama](https://github.com/meta-llama/PurpleLlama) | Safety-tuned Llama variants and their release history | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="mistral"></a>
## Mistral

Mistral AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [mistralai on Hugging Face](https://huggingface.co/mistralai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [docs.mistral.ai/getting-started/models](https://docs.mistral.ai/getting-started/models) | Model documentation and release history | announcement, api |
| [mistral.ai/news](https://mistral.ai/news) | Publisher announcements and release history | announcement, api |
| [github.com/mistralai/mistral-inference](https://github.com/mistralai/mistral-inference) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="qwen"></a>
## Qwen

Alibaba

| Page | Watch for | Evidence |
| --- | --- | --- |
| [Qwen on Hugging Face](https://huggingface.co/Qwen/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.alibabacloud.com/help/en/model-studio/newly-released-models](https://www.alibabacloud.com/help/en/model-studio/newly-released-models) | Model documentation and release history | announcement, api |
| [qwenlm.github.io/blog/](https://qwenlm.github.io/blog/) | Publisher announcements and release history | announcement, api |
| [qwen.ai/blog](https://qwen.ai/blog) | Publisher announcements and release history | announcement, api |
| [github.com/QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) | Official code, model cards, and release links | announcement, weights |
| [github.com/QwenLM/Qwen2.5](https://github.com/QwenLM/Qwen2.5) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="deepseek"></a>
## DeepSeek

DeepSeek

| Page | Watch for | Evidence |
| --- | --- | --- |
| [deepseek-ai on Hugging Face](https://huggingface.co/deepseek-ai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [api-docs.deepseek.com/updates/](https://api-docs.deepseek.com/updates/) | Model documentation and release history | announcement, api |
| [github.com/deepseek-ai/DeepSeek-V3](https://github.com/deepseek-ai/DeepSeek-V3) | Official code, model cards, and release links | announcement, weights |
| [github.com/deepseek-ai/DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="kimi"></a>
## Kimi

Moonshot AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [moonshotai on Hugging Face](https://huggingface.co/moonshotai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.kimi.com/code/docs/en/kimi-code/whats-new.html](https://www.kimi.com/code/docs/en/kimi-code/whats-new.html) | Model documentation and release history | announcement, api |
| [platform.moonshot.ai/docs/intro](https://platform.moonshot.ai/docs/intro) | Publisher announcements and release history | announcement, api |
| [github.com/MoonshotAI/Kimi-K2](https://github.com/MoonshotAI/Kimi-K2) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="glm"></a>
## GLM

Z.ai

| Page | Watch for | Evidence |
| --- | --- | --- |
| [zai-org on Hugging Face](https://huggingface.co/zai-org/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [docs.z.ai/release-notes/new-released](https://docs.z.ai/release-notes/new-released) | Model documentation and release history | announcement, api |
| [github.com/zai-org/GLM-4](https://github.com/zai-org/GLM-4) | Official code, model cards, and release links | announcement, weights |
| [github.com/THUDM/ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="muse"></a>
## Muse

Meta

| Page | Watch for | Evidence |
| --- | --- | --- |
| [research.meta.ai/](https://research.meta.ai/) | Model documentation and release history | announcement, api |
| [ai.meta.com/blog/](https://ai.meta.com/blog/) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="gemma"></a>
## Gemma

Google DeepMind

| Page | Watch for | Evidence |
| --- | --- | --- |
| [google on Hugging Face](https://huggingface.co/google/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [ai.google.dev/gemma/docs/releases](https://ai.google.dev/gemma/docs/releases) | Publisher announcements and release history | announcement, api |
| [ai.google.dev/gemma/docs](https://ai.google.dev/gemma/docs) | Publisher announcements and release history | announcement, api |
| [github.com/google-deepmind/gemma](https://github.com/google-deepmind/gemma) | Official code, model cards, and release links | announcement, weights |
| [huggingface.co/google/collections](https://huggingface.co/google/collections) | Publisher collections and model links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

Text-generating encoder-decoder and multimodal variants, including T5Gemma, are in scope. Embedding-only checkpoints and interpretability tools stay in the inventory with explicit exclusions.

<a id="phi"></a>
## Phi

Microsoft

| Page | Watch for | Evidence |
| --- | --- | --- |
| [microsoft on Hugging Face](https://huggingface.co/microsoft/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/microsoft/PhiCookBook](https://github.com/microsoft/PhiCookBook) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="olmo"></a>
## OLMo

Ai2

| Page | Watch for | Evidence |
| --- | --- | --- |
| [allenai on Hugging Face](https://huggingface.co/allenai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [allenai.org/blog](https://allenai.org/blog) | Publisher announcements and release history | announcement, api |
| [github.com/allenai/OLMo](https://github.com/allenai/OLMo) | Official code, model cards, and release links | announcement, weights |
| [github.com/allenai/OLMo-core](https://github.com/allenai/OLMo-core) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="minimax"></a>
## MiniMax

MiniMax

| Page | Watch for | Evidence |
| --- | --- | --- |
| [MiniMaxAI on Hugging Face](https://huggingface.co/MiniMaxAI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [agent.minimax.io/docs/changelog](https://agent.minimax.io/docs/changelog) | Model documentation and release history | announcement, api |
| [www.minimax.io/news](https://www.minimax.io/news) | Publisher announcements and release history | announcement, api |
| [github.com/MiniMax-AI/MiniMax-M1](https://github.com/MiniMax-AI/MiniMax-M1) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="nova"></a>
## Amazon Nova

Amazon

| Page | Watch for | Evidence |
| --- | --- | --- |
| [docs.aws.amazon.com/nova/latest/nova2-userguide/what-is-nova-2.html](https://docs.aws.amazon.com/nova/latest/nova2-userguide/what-is-nova-2.html) | Model documentation and release history | announcement, api |
| [aws.amazon.com/ai/generative-ai/nova/](https://aws.amazon.com/ai/generative-ai/nova/) | Publisher announcements and release history | announcement, api |
| [github.com/aws-samples/amazon-nova-samples](https://github.com/aws-samples/amazon-nova-samples) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="ernie"></a>
## ERNIE

Baidu

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ernie.baidu.com/blog/posts/](https://ernie.baidu.com/blog/posts/) | Model documentation and release history | announcement, api |
| [baidu on Hugging Face](https://huggingface.co/baidu/models) | Publisher model inventory (all pages) | weights |
| [github.com/PaddlePaddle/ERNIE](https://github.com/PaddlePaddle/ERNIE) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="openai-o"></a>
## OpenAI o

OpenAI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models) | Model documentation and release history | announcement, api |
| [developers.openai.com/api/docs/models/o4-mini](https://developers.openai.com/api/docs/models/o4-mini) | Model documentation and release history | announcement, api |
| [openai.com/news/](https://openai.com/news/) | Publisher announcements and release history | announcement, api |
| [developers.openai.com/api/docs/changelog](https://developers.openai.com/api/docs/changelog) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="pangu"></a>
## PanGu

Huawei

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.huaweicloud.com/product/pangu.html](https://www.huaweicloud.com/product/pangu.html) | Model documentation and release history | announcement, api |
| [www.huaweicloud.com/eu/news/20250620192415143.html](https://www.huaweicloud.com/eu/news/20250620192415143.html) | Model documentation and release history | announcement, api |
| [openpangu on Hugging Face](https://huggingface.co/openpangu/models) | Publisher model inventory (all pages) | weights |
| [huawei-noah on Hugging Face](https://huggingface.co/huawei-noah/models) | Publisher model inventory (all pages) | weights |
| [github.com/huawei-noah/Pretrained-Language-Model](https://github.com/huawei-noah/Pretrained-Language-Model) | Official code, model cards, and release links | announcement, weights |
| [huggingface.co/openpangu](https://huggingface.co/openpangu) | Publisher collections and model links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="mimo"></a>
## MiMo

Xiaomi

| Page | Watch for | Evidence |
| --- | --- | --- |
| [mimo.mi.com/docs/en-US/updates/model](https://mimo.mi.com/docs/en-US/updates/model) | Model documentation and release history | announcement, api |
| [XiaomiMiMo on Hugging Face](https://huggingface.co/XiaomiMiMo/models) | Publisher model inventory (all pages) | weights |
| [github.com/XiaomiMiMo/MiMo](https://github.com/XiaomiMiMo/MiMo) | Official code, model cards, and release links | announcement, weights |
| [mimo.mi.com/](https://mimo.mi.com/) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="granite"></a>
## Granite

IBM

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ibm-granite on Hugging Face](https://huggingface.co/ibm-granite/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.ibm.com/granite/docs/](https://www.ibm.com/granite/docs/) | Publisher announcements and release history | announcement, api |
| [research.ibm.com/topics/granite](https://research.ibm.com/topics/granite) | Publisher announcements and release history | announcement, api |
| [github.com/ibm-granite/granite-code-models](https://github.com/ibm-granite/granite-code-models) | Official code, model cards, and release links | announcement, weights |
| [github.com/ibm-granite/granite-3.0-language-models](https://github.com/ibm-granite/granite-3.0-language-models) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

Some publisher pages require JavaScript or have removed historical content. Capture failures remain explicit review items; the Hugging Face inventory is checked independently.

<a id="nemotron"></a>
## Nemotron

NVIDIA

| Page | Watch for | Evidence |
| --- | --- | --- |
| [nvidia on Hugging Face](https://huggingface.co/nvidia/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [research.nvidia.com/labs/nemotron/](https://research.nvidia.com/labs/nemotron/) | Publisher announcements and release history | announcement, api |
| [github.com/NVIDIA-NeMo/Nemotron](https://github.com/NVIDIA-NeMo/Nemotron) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="seed"></a>
## Seed

ByteDance

| Page | Watch for | Evidence |
| --- | --- | --- |
| [seed.bytedance.com/en/](https://seed.bytedance.com/en/) | Model documentation and release history | announcement, api |
| [ByteDance-Seed on Hugging Face](https://huggingface.co/ByteDance-Seed/models) | Publisher model inventory (all pages) | weights |
| [seed.bytedance.com/en/seed_model_portfolio](https://seed.bytedance.com/en/seed_model_portfolio) | Publisher announcements and release history | announcement, api |
| [github.com/ByteDance-Seed](https://github.com/ByteDance-Seed) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="palm"></a>
## PaLM

Google

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ai.google/discover/palm2/](https://ai.google/discover/palm2/) | Model documentation and release history | announcement, api |
| [research.google/blog/pathways-language-model-palm-scaling-to-540-billion-parameters-for-breakthrough-performance/](https://research.google/blog/pathways-language-model-palm-scaling-to-540-billion-parameters-for-breakthrough-performance/) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="yi"></a>
## Yi

01.AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [01-ai on Hugging Face](https://huggingface.co/01-ai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/01-ai/Yi](https://github.com/01-ai/Yi) | Official code, model cards, and release links | announcement, weights |
| [github.com/01-ai/Yi-1.5](https://github.com/01-ai/Yi-1.5) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="internlm"></a>
## InternLM / InternVL

Shanghai AI Laboratory

| Page | Watch for | Evidence |
| --- | --- | --- |
| [internlm on Hugging Face](https://huggingface.co/internlm/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [OpenGVLab on Hugging Face](https://huggingface.co/OpenGVLab/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/InternLM/InternLM](https://github.com/InternLM/InternLM) | Official code, model cards, and release links | announcement, weights |
| [github.com/OpenGVLab/InternVL](https://github.com/OpenGVLab/InternVL) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="exaone"></a>
## EXAONE

LG AI Research

| Page | Watch for | Evidence |
| --- | --- | --- |
| [LGAI-EXAONE on Hugging Face](https://huggingface.co/LGAI-EXAONE/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.lgresearch.ai/news](https://www.lgresearch.ai/news) | Publisher announcements and release history | announcement, api |
| [github.com/LG-AI-EXAONE/EXAONE-3.0](https://github.com/LG-AI-EXAONE/EXAONE-3.0) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="minicpm"></a>
## MiniCPM

OpenBMB

| Page | Watch for | Evidence |
| --- | --- | --- |
| [openbmb on Hugging Face](https://huggingface.co/openbmb/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/OpenBMB/MiniCPM](https://github.com/OpenBMB/MiniCPM) | Official code, model cards, and release links | announcement, weights |
| [github.com/OpenBMB/MiniCPM-V](https://github.com/OpenBMB/MiniCPM-V) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="step"></a>
## Step

StepFun

| Page | Watch for | Evidence |
| --- | --- | --- |
| [stepfun-ai on Hugging Face](https://huggingface.co/stepfun-ai/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [platform.stepfun.com/](https://platform.stepfun.com/) | Model documentation and release history | announcement, api |
| [www.stepfun.com/](https://www.stepfun.com/) | Publisher announcements and release history | announcement, api |
| [github.com/stepfun-ai/Step3](https://github.com/stepfun-ai/Step3) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="ling"></a>
## Ling

inclusionAI / Ant Group

| Page | Watch for | Evidence |
| --- | --- | --- |
| [inclusionAI on Hugging Face](https://huggingface.co/inclusionAI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [vercel.com/ai-gateway/models/ling-3.1-flash](https://vercel.com/ai-gateway/models/ling-3.1-flash) | Model documentation and release history | announcement, api |
| [github.com/inclusionAI/Ling](https://github.com/inclusionAI/Ling) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="falcon"></a>
## Falcon

Technology Innovation Institute

| Page | Watch for | Evidence |
| --- | --- | --- |
| [tiiuae on Hugging Face](https://huggingface.co/tiiuae/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [falconllm.tii.ae/](https://falconllm.tii.ae/) | Publisher announcements and release history | announcement, api |
| [github.com/tiiuae](https://github.com/tiiuae) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="jamba"></a>
## Jamba

AI21 Labs

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ai21labs on Hugging Face](https://huggingface.co/ai21labs/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.ai21.com/blog/jamba/](https://www.ai21.com/blog/jamba/) | Publisher announcements and release history | announcement, api |
| [docs.ai21.com/docs/jamba-foundation-models](https://docs.ai21.com/docs/jamba-foundation-models) | Publisher announcements and release history | announcement, api |
| [github.com/AI21Labs](https://github.com/AI21Labs) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="inflection"></a>
## Inflection

Inflection AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [inflection.ai/blog](https://inflection.ai/blog) | Model documentation and release history | announcement, api |
| [inflection.ai/blog/enterprise](https://inflection.ai/blog/enterprise) | Model documentation and release history | announcement, api |
| [github.com/InflectionAI/Inflection-Benchmarks](https://github.com/InflectionAI/Inflection-Benchmarks) | Publisher research and historical model references | announcement |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="lfm"></a>
## LFM

Liquid AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [LiquidAI on Hugging Face](https://huggingface.co/LiquidAI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.liquid.ai/models](https://www.liquid.ai/models) | Publisher announcements and release history | announcement, api |
| [www.liquid.ai/blog](https://www.liquid.ai/blog) | Publisher announcements and release history | announcement, api |
| [github.com/Liquid4All](https://github.com/Liquid4All) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="hermes"></a>
## Hermes

Nous Research

| Page | Watch for | Evidence |
| --- | --- | --- |
| [NousResearch on Hugging Face](https://huggingface.co/NousResearch/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [nousresearch.com/](https://nousresearch.com/) | Publisher announcements and release history | announcement, api |
| [github.com/NousResearch/Hermes-Function-Calling](https://github.com/NousResearch/Hermes-Function-Calling) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="openchat"></a>
## OpenChat

OpenChat Team

| Page | Watch for | Evidence |
| --- | --- | --- |
| [openchat on Hugging Face](https://huggingface.co/openchat/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/imoneoi/openchat](https://github.com/imoneoi/openchat) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="hunyuan"></a>
## Hunyuan / Hy

Tencent

| Page | Watch for | Evidence |
| --- | --- | --- |
| [tencent on Hugging Face](https://huggingface.co/tencent/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [hunyuan.tencent.com/](https://hunyuan.tencent.com/) | Publisher announcements and release history | announcement, api |
| [github.com/Tencent/Hunyuan-Large](https://github.com/Tencent/Hunyuan-Large) | Official code, model cards, and release links | announcement, weights |
| [github.com/Tencent-Hunyuan](https://github.com/Tencent-Hunyuan) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="longcat"></a>
## LongCat

Meituan

| Page | Watch for | Evidence |
| --- | --- | --- |
| [longcat.chat/platform/docs/ChangeLog.html](https://longcat.chat/platform/docs/ChangeLog.html) | Model documentation and release history | announcement, api |
| [meituan-longcat on Hugging Face](https://huggingface.co/meituan-longcat/models) | Publisher model inventory (all pages) | weights |
| [longcat.ai/](https://longcat.ai/) | Publisher announcements and release history | announcement, api |
| [github.com/meituan-longcat/LongCat-Flash-Chat](https://github.com/meituan-longcat/LongCat-Flash-Chat) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

Some publisher pages require JavaScript or have removed historical content. Capture failures remain explicit review items; the Hugging Face inventory is checked independently.

<a id="solar"></a>
## Solar

Upstage

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.upstage.ai/news](https://www.upstage.ai/news) | Model documentation and release history | announcement, api |
| [upstage on Hugging Face](https://huggingface.co/upstage/models) | Publisher model inventory (all pages) | weights |
| [www.upstage.ai/blog](https://www.upstage.ai/blog) | Publisher announcements and release history | announcement, api |
| [github.com/UpstageAI](https://github.com/UpstageAI) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="mercury"></a>
## Mercury

Inception

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.inceptionlabs.ai/blog](https://www.inceptionlabs.ai/blog) | Model documentation and release history | announcement, api |
| [docs.inceptionlabs.ai/](https://docs.inceptionlabs.ai/) | Publisher announcements and release history | announcement, api |
| [www.inceptionlabs.ai/blog/introducing-mercury-2](https://www.inceptionlabs.ai/blog/introducing-mercury-2) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

No verified publisher Hugging Face inventory is configured for this family; watch the official release pages for any weights announcement.

<a id="motif"></a>
## Motif

Motif Technologies

| Page | Watch for | Evidence |
| --- | --- | --- |
| [chat.motiftech.io/release](https://chat.motiftech.io/release) | Model documentation and release history | announcement, api |
| [Motif-Technologies on Hugging Face](https://huggingface.co/Motif-Technologies/models) | Publisher model inventory (all pages) | weights |
| [huggingface.co/motif-technologies](https://huggingface.co/motif-technologies) | Publisher collections and model links | announcement, weights |
| [github.com/motiftechnologies](https://github.com/motiftechnologies) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

The publisher account is Motif-Technologies; repository spelling and case are preserved.

<a id="intellect"></a>
## INTELLECT

Prime Intellect

| Page | Watch for | Evidence |
| --- | --- | --- |
| [PrimeIntellect on Hugging Face](https://huggingface.co/PrimeIntellect/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.primeintellect.ai/blog](https://www.primeintellect.ai/blog) | Publisher announcements and release history | announcement, api |
| [github.com/PrimeIntellect-ai/prime](https://github.com/PrimeIntellect-ai/prime) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="cogito"></a>
## Cogito

Deep Cogito

| Page | Watch for | Evidence |
| --- | --- | --- |
| [deepcogito on Hugging Face](https://huggingface.co/deepcogito/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [www.deepcogito.com/research](https://www.deepcogito.com/research) | Publisher announcements and release history | announcement, api |
| [github.com/DeepCogito/cogito-v2](https://github.com/DeepCogito/cogito-v2) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="reka"></a>
## Reka

Reka AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [RekaAI on Hugging Face](https://huggingface.co/RekaAI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [reka.ai/legal/latest-changes](https://reka.ai/legal/latest-changes) | Model documentation and release history | announcement, api |
| [reka.ai/news](https://reka.ai/news) | Publisher announcements and release history | announcement, api |
| [github.com/reka-ai](https://github.com/reka-ai) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="apriel"></a>
## Apriel

ServiceNow

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ServiceNow-AI on Hugging Face](https://huggingface.co/ServiceNow-AI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [huggingface.co/ServiceNow-AI/collections](https://huggingface.co/ServiceNow-AI/collections) | Publisher collections and model links | announcement, weights |
| [github.com/ServiceNow/Apriel](https://github.com/ServiceNow/Apriel) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="nanbeige"></a>
## Nanbeige

Nanbeige LLM Lab

| Page | Watch for | Evidence |
| --- | --- | --- |
| [Nanbeige on Hugging Face](https://huggingface.co/Nanbeige/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/Nanbeige/Nanbeige](https://github.com/Nanbeige/Nanbeige) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

The historical GitHub repository and some older Hugging Face checkpoints are unavailable. Failures remain visible in the audit; a current listing alone cannot establish earlier coverage.

Some publisher pages require JavaScript or have removed historical content. Capture failures remain explicit review items; the Hugging Face inventory is checked independently.

<a id="ring"></a>
## Ring

inclusionAI / Ant Group

| Page | Watch for | Evidence |
| --- | --- | --- |
| [inclusionAI on Hugging Face](https://huggingface.co/inclusionAI/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/inclusionAI/Ring](https://github.com/inclusionAI/Ring) | Official code, model cards, and release links | announcement, weights |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="ax"></a>
## A.X

SK Telecom

| Page | Watch for | Evidence |
| --- | --- | --- |
| [skt on Hugging Face](https://huggingface.co/skt/models) | Publisher model inventory (all pages, including earlier and unnumbered variants) | weights |
| [github.com/SKT-AI/A.X-3](https://github.com/SKT-AI/A.X-3) | Official code, model cards, and release links | announcement, weights |
| [news.sktelecom.com/en/678](https://news.sktelecom.com/en/678) | Publisher announcements and release history | announcement, api |

The inventory includes unnumbered variants and older generations. Each candidate still needs identity, date, and availability evidence.

<a id="python"></a>
## Python

Python Software Foundation · software control

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.python.org/doc/versions/](https://www.python.org/doc/versions/) | Model documentation and release history | announcement, api |
| [github.com/python/cpython](https://github.com/python/cpython) | Official code, model cards, and release links | announcement, weights |
| [www.python.org/downloads/](https://www.python.org/downloads/) | Publisher announcements and release history | announcement, api |

Software controls only; excluded from model rankings. Watch sources do not expand the declared control scope automatically.

<a id="pytorch"></a>
## PyTorch

PyTorch Foundation · software control

| Page | Watch for | Evidence |
| --- | --- | --- |
| [github.com/pytorch/pytorch/releases](https://github.com/pytorch/pytorch/releases) | Model documentation and release history | announcement, api |
| [pytorch.org/blog/](https://pytorch.org/blog/) | Publisher announcements and release history | announcement, api |
| [github.com/pytorch/pytorch](https://github.com/pytorch/pytorch) | Official code, model cards, and release links | announcement, weights |

Software controls only; excluded from model rankings. Watch sources do not expand the declared control scope automatically.

<a id="gta"></a>
## GTA

Rockstar Games · software control

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.rockstargames.com/gta-v](https://www.rockstargames.com/gta-v) | Model documentation and release history | announcement, api |
| [www.rockstargames.com/newswire](https://www.rockstargames.com/newswire) | Publisher announcements and release history | announcement, api |

Software controls only; excluded from model rankings. Watch sources do not expand the declared control scope automatically.

<a id="ornith"></a>
## Ornith

Ornith AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [ornith-ai on Hugging Face](https://huggingface.co/ornith-ai/models) | All official Ornith checkpoints and packaging variants | weights |
| [github.com/ornith-ai/Ornith-1](https://github.com/ornith-ai/Ornith-1) | Publisher repository and release links | announcement, weights |
| [ornith.ai/ornith_1_5.html](https://ornith.ai/ornith_1_5.html) | Publisher model announcement | announcement |
| [ornith.ai/ornith_1_0.html](https://ornith.ai/ornith_1_0.html) | Historical first-generation announcement | announcement |

<a id="smollm"></a>
## SmolLM

Hugging Face

| Page | Watch for | Evidence |
| --- | --- | --- |
| [HuggingFaceTB on Hugging Face](https://huggingface.co/HuggingFaceTB/models) | All SmolLM and SmolVLM checkpoints | weights |
| [github.com/huggingface/smollm](https://github.com/huggingface/smollm) | Language and vision model releases and training recipes | announcement, weights |
| [huggingface.co/blog/smollm3](https://huggingface.co/blog/smollm3) | Latest numbered language-model release and related posts | announcement |
| [huggingface.co/blog/smolvlm2](https://huggingface.co/blog/smolvlm2) | Vision-language release and related posts | announcement |

<a id="bonsai"></a>
## Bonsai / Ternary

PrismML

| Page | Watch for | Evidence |
| --- | --- | --- |
| [prism-ml on Hugging Face](https://huggingface.co/prism-ml/models) | Binary and ternary language checkpoints; image models are reviewed separately | weights |
| [prismml.com/blog](https://prismml.com/blog) | Dated model announcements | announcement |
| [prismml.com/news](https://prismml.com/news) | Publisher news archive | announcement |
| [github.com/PrismML-Eng/Bonsai-demo](https://github.com/PrismML-Eng/Bonsai-demo) | Official demos, model table, and framework support | weights |

<a id="dolphin"></a>
## Dolphin

Dolphin / Eric Hartford

| Page | Watch for | Evidence |
| --- | --- | --- |
| [dphn on Hugging Face](https://huggingface.co/dphn/models) | Every official Dolphin repository, including historical releases moved from cognitivecomputations | weights |
| [github.com/QuixiAI/dolphin](https://github.com/QuixiAI/dolphin) | Training repository and model documentation | announcement, weights |
| [dolphinmodel.com/](https://dolphinmodel.com/) | Publisher model pages and announcements | announcement |

Patch segments are joined after the first decimal point: Dolphin 2.9.3 scores 2.93. The original label is retained. Current repository commit history is not proof of the first public availability date.

<a id="character-ai"></a>
## Character.AI

Character.AI

| Page | Watch for | Evidence |
| --- | --- | --- |
| [blog.character.ai/](https://blog.character.ai/) | Publisher posts, model rollouts, and chat-style changes | announcement, hosted |
| [support.character.ai/hc/en-us/sections/15013580182799-Announcements](https://support.character.ai/hc/en-us/sections/15013580182799-Announcements) | Dated community announcements | announcement, hosted |
| [blog.character.ai/pipsqueak2-and-more/](https://blog.character.ai/pipsqueak2-and-more/) | PipSqueak 2 access by subscription tier | announcement, hosted |
| [blog.character.ai/new-styles-new-plan/](https://blog.character.ai/new-styles-new-plan/) | PipSqueak 3 and later related posts | announcement, hosted |

No official downloadable checkpoint was identified for the recorded chat styles. An open-source base model does not establish that Character.AI published its fine-tuned weights. c.ai 1.0/1.1/1.2 need primary date and model-identity evidence.

<a id="apple"></a>
## Apple Foundation Models

Apple

| Page | Watch for | Evidence |
| --- | --- | --- |
| [machinelearning.apple.com/highlights](https://machinelearning.apple.com/highlights) | Dated Apple foundation-model research and announcements | announcement, research |
| [machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models) | Explicit generation numbering and model variants | announcement, research |
| [developer.apple.com/documentation/Updates/FoundationModels](https://developer.apple.com/documentation/Updates/FoundationModels) | Framework and model availability updates; do not score SDK or OS versions | api |
| [apple on Hugging Face](https://huggingface.co/apple/models) | Watch for a matching AFM checkpoint; unrelated Apple research models are not AFM weights | weights |
| [github.com/apple](https://github.com/apple) | Official research repositories and Foundation Models tooling | research, weights |

Apple’s publicly distributed research models and MLX conversions are not automatically the proprietary Apple Intelligence foundation models. The Hugging Face AFM scope may legitimately return no matching repository; this remains a visible check.

<a id="jan"></a>
## Jan

Jan

| Page | Watch for | Evidence |
| --- | --- | --- |
| [jan.ai/blog](https://jan.ai/blog) | Publisher model announcements; Jan application versions do not count. | announcement, api |
| [janhq on Hugging Face](https://huggingface.co/janhq/models) | Enumerate all publisher repositories, including earlier generations and named variants. | weights |
| [github.com/janhq](https://github.com/janhq) | Organization model repositories; distinguish model versions from the desktop application. | research, weights |

The Jan application is not this model family. Quantization and format variants are excluded. Checkpoint history dates are not proof of the first public release.

<a id="palmyra"></a>
## Palmyra

WRITER

| Page | Watch for | Evidence |
| --- | --- | --- |
| [writer.com/engineering/](https://writer.com/engineering/) | Engineering announcements and model generations. | announcement, api |
| [dev.writer.com/home/models](https://dev.writer.com/home/models) | API model identities, current availability and deprecations. | announcement, api |
| [Writer on Hugging Face](https://huggingface.co/Writer/models) | Enumerate all publisher repositories, including earlier generations and named variants. | weights |

Dummy-weight test repositories do not establish open weights. Parameter counts and specialist-line names do not supply version numbers. Palmyra X4.3 weights are not weights for the hosted X4, X5 or X6 models.

<a id="laguna"></a>
## Laguna

Poolside

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.poolside.ai/blog](https://www.poolside.ai/blog) | Model announcements, API previews and later weight releases. | announcement, api |
| [poolside on Hugging Face](https://huggingface.co/poolside/models) | Enumerate all publisher repositories, including earlier generations and named variants. | weights |
| [github.com/poolsideai](https://github.com/poolsideai) | Publisher model cards and research repositories. | research, weights |

Size lines M, S and XS retain their own published generation numbers. Speculative decoding drafts, test fixtures and format conversions are not separate language-model releases.

<a id="aion"></a>
## Aion

Aion Labs

| Page | Watch for | Evidence |
| --- | --- | --- |
| [www.aionlabs.ai/docs/models/](https://www.aionlabs.ai/docs/models/) | Publisher model identities and explicit release dates. | announcement, api |
| [openrouter.ai/aion-labs](https://openrouter.ai/aion-labs) | Gateway inventory and retired variants; listing dates are distinct from release dates. | announcement, api |

Aion Labs is distinct from Microsoft’s Aion research model. No official public checkpoint repository was identified for these hosted variants; upstream GLM, DeepSeek and Llama weights are not exact Aion weights.
