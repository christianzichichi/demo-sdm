/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    Configuration,
    safeExec,
} from "@atomist/automation-client";
import {
    AutomationMetadata,
    CommandHandlerMetadata,
} from "@atomist/automation-client/lib/metadata/automationMetadata";
import { AutomationMetadataProcessor } from "@atomist/automation-client/lib/spi/env/MetadataProcessor";
import {
    ConfigureOptions,
    configureSdm,
    isGitHubAction,
} from "@atomist/sdm-core";
import * as appRoot from "app-root-path";
import * as path from "path";
import { machine } from "./lib/machine/machine";

const machineOptions: ConfigureOptions = {
    requiredConfigurationValues: [
        "sdm.docker.hub.registry",
        "sdm.docker.hub.user",
        "sdm.docker.hub.password",
    ],
};

/**
 * AutomationMetadataProcessor that rewrites all requested secrets to use values instead
 */
export class LocalSecretRewritingMetadataProcessor implements AutomationMetadataProcessor {

    public process<T extends AutomationMetadata>(metadata: T): T {
        const cmd = metadata as CommandHandlerMetadata;
        cmd.secrets.filter(s => s.uri.startsWith("github://"))
            .forEach(s => {
                cmd.values.push({ name: s.name, path: "token", required: true, type: "string" });
            });
        cmd.secrets = cmd.secrets.filter(s => !s.uri.startsWith("github://"));
        return metadata;
    }
}

export const configuration: Configuration = {
    postProcessors: [
        async config => {
            if (isGitHubAction()) {
                config.environment = "gke-int-demo";
                config.apiKey = "${ATOMIST_API_KEY}";
                config.token = "${ATOMIST_GITHUB_TOKEN}";
                config.sdm = {
                    ...config.sdm,
                    docker: {
                        hub: {
                            registry: "atomist",
                            user: "${DOCKER_USER}",
                            password: "${DOCKER_PASSWORD}",
                        },
                    },
                };

                await safeExec("git", ["config", "--global", "user.email", "\"bot@atomist.com\""]);
                await safeExec("git", ["config", "--global", "user.name", "\"Atomist Bot\""]);

            }
            return config;
        },
        configureSdm(machine, machineOptions),
    ],
    sdm: {
        spring: {
            formatJar: path.join(appRoot.path, "bin", "spring-format-0.1.0-SNAPSHOT-jar-with-dependencies.jar"),
        },
        build: {
            tag: false,
        },
    },
    metadataProcessor: new LocalSecretRewritingMetadataProcessor(),
};

