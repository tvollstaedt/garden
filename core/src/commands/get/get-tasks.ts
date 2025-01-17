/*
 * Copyright (C) 2018-2021 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import indentString from "indent-string"
import { sortBy, omit, uniq } from "lodash"
import { Command, CommandResult, CommandParams } from "../base"
import { printHeader } from "../../logger/util"
import { GardenTask } from "../../types/task"
import { StringsParameter } from "../../cli/params"

const getTasksArgs = {
  tasks: new StringsParameter({
    help: "Specify task(s) to list. Use comma as a separator to specify multiple tasks.",
  }),
}

type Args = typeof getTasksArgs

export function prettyPrintTask(task: GardenTask): string {
  let out = `${chalk.cyan.bold(task.name)}`

  if (task.spec.args || task.spec.args === null) {
    out += "\n" + indentString(printField("args", task.spec.args), 2)
  } else {
    out += "\n" + indentString(printField("command", task.spec.command), 2)
  }

  if (task.spec.description) {
    out += "\n" + indentString(printField("description", task.spec.description), 2)
  }

  if (task.config.dependencies.length) {
    out += "\n" + indentString(`${chalk.gray("dependencies")}:`, 2) + "\n"
    out += indentString(task.config.dependencies.map((depName) => `• ${depName}`).join("\n"), 4)
    out += "\n"
  } else {
    out += "\n"
  }

  return out
}

function printField(name: string, value: string | null) {
  return `${chalk.gray(name)}: ${value || ""}`
}

export class GetTasksCommand extends Command<Args> {
  name = "tasks"
  help = "Lists the tasks defined in your project's modules."

  arguments = getTasksArgs

  printHeader({ headerLog }) {
    printHeader(headerLog, "Tasks", "open_book")
  }

  async action({ args, garden, log }: CommandParams<Args>): Promise<CommandResult> {
    const graph = await garden.getConfigGraph(log)
    const tasks = graph.getTasks({ names: args.tasks })
    const taskModuleNames = uniq(tasks.map((t) => t.module.name))
    const modules = sortBy(graph.getModules({ names: taskModuleNames }), (m) => m.name)

    const taskListing: any[] = []
    let logStr = ""

    for (const m of modules) {
      const tasksForModule = sortBy(
        tasks.filter((t) => t.module.name === m.name),
        (t) => t.name
      )

      const logStrForTasks = tasksForModule.map((t) => indentString(prettyPrintTask(t), 2)).join("\n")

      logStr += `tasks in module ${chalk.green(m.name)}` + "\n" + logStrForTasks + "\n"

      taskListing.push({
        [m.name]: tasksForModule.map((t) => ({
          ...omit(t.config.spec, ["timeout"]),
          name: t.name,
          description: t.config.spec.description,
          dependencies: t.config.spec.dependencies,
        })),
      })
    }

    if (taskListing.length > 0) {
      log.info(logStr.trim())
    } else {
      log.info(`No tasks defined for project ${garden.projectName}`)
    }

    return { result: taskListing }
  }
}
