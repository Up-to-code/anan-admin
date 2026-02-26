/**
 * Shared model-failover execution loop.
 * Eliminates duplication between generateResponse and generateReplyAndReturnText.
 */
import { debugLog } from "../debug";
import {
    isModelFailoverError,
    isRateLimitedError,
} from "../modelFailover";
import {
    getFailoverDelayMs,
    getModelCooldownUntil,
    markModelRateLimited,
    sleepMs,
} from "./rateLimitCooldown";

export type ModelFailoverOptions<T> = {
    models: string[];
    /** Human label for debug logs */
    scope: string;
    threadId?: string;
    /** The actual LLM call for each model */
    runModel: (model: string) => Promise<T>;
};

/**
 * Runs `runModel` against each model in order, with cooldown skipping and
 * failover on transient errors. Returns the first successful result.
 * Throws the last error if all models fail.
 */
export async function runWithModelFailover<T>(
    opts: ModelFailoverOptions<T>,
): Promise<T> {
    const { models, scope, threadId, runModel } = opts;

    if (models.length === 0) {
        throw new Error(`No agent model available for ${scope}`);
    }

    let lastError: unknown;

    for (let i = 0; i < models.length; i += 1) {
        const model = models[i]!;

        const cooldownUntil = getModelCooldownUntil(model);
        if (cooldownUntil) {
            debugLog(scope, "model_skipped_cooldown", {
                threadId,
                selectedModel: model,
                cooldownUntil,
            });
            continue;
        }

        try {
            return await runModel(model);
        } catch (error) {
            lastError = error;
            if (isRateLimitedError(error)) markModelRateLimited(model, error);
            if (!isModelFailoverError(error)) throw error;

            debugLog(scope, "model_failover", {
                threadId,
                selectedModel: model ?? "default",
                fallbackModel: models[i + 1] ?? "none",
            });

            if (i < models.length - 1) {
                await sleepMs(getFailoverDelayMs(error, i));
            }
        }
    }

    if (lastError) throw lastError;
    throw new Error(`No agent model attempts executed for ${scope}`);
}
