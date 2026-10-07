tasks.register<Exec>("assembleDebug") {
    commandLine("npm", "run", "build")
}

tasks.register("assemble") {
    dependsOn("assembleDebug")
}

tasks.register("build") {
    dependsOn("assembleDebug")
}
