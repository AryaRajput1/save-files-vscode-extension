<script setup>
import { commands } from 'vscode';
import { onMounted, ref } from 'vue';

const isLoggedIn = ref(false)
const projects = ref({})
const message = ref('')

onMounted(() => {
    window.addEventListener('message', (e) => {
        const type = e.data.type
        if (type === 'save-files') {
            message.value = e.data.value
        }
        else if (type === 'authentication') {
            isLoggedIn.value = !!e.data.value
        } else if (type === 'get-files') {
            projects.value = JSON.parse(e.data.value)
        } else if (type === 'logout') {
            isLoggedIn.value = false
            projects.value = {}
            message.value
        } else if (type === 'delete-success') {
            onGetFiles()
        }
    })
})

const onClick = () => {
    context.postMessage({
        type: 'onInfo',
        value: 'info Message'
    })
}

const onSignIn = () => {
    context.postMessage({
        type: 'sign-in',
        value: 'info Message'
    })
}

const onLogout = () => {
    context.postMessage({
        type: 'logout',
        value: 'Logout'
    })
}
const onGetFiles = () => {
    message.value = ''
    context.postMessage({
        type: 'get-files',
        value: 'info Message'
    })
}

const deleteProject = (id) => {
    console.log({ id })
    context.postMessage({
        type: 'delete-project',
        value: id
    })
}

</script>
<template>
    <div>
        <button v-if="!isLoggedIn" @click="onSignIn">Sign In</button>
        <template v-else>
            <button @click="onClick">Save Project Files</button>
            <button @click="onGetFiles">Fetch Saved Projects</button>
            <button @click="onLogout">Logout</button>
            <p class="message">{{ message }}</p>
            <ul v-if="Object.entries(projects).length">
                <li v-for="(project, index) in Object.entries(projects)">
                    <div class="project">{{ project[0] }} <span class="delete"
                            @click="() => deleteProject(project[0])">X</span></div>
                    <ol>
                        <li v-for="files in project[1]" class="files">{{ files }}</li>
                    </ol>
                </li>
            </ul>
            <p v-else-if="!message" class="message">No Files. Try to save files or fetch files</p>
        </template>
    </div>
</template>
<style>
ul {
    margin-left: 10px;
    list-style-type: none;
    color: rgb(173, 173, 173);
}

.files {
    margin-left: 15px;
}

.project {
    color: white;
    font-size: 16px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

* {
    margin: 5px;
}

.message {
    color: rgb(19, 213, 19);
    margin: 15px;
}

.delete {
    background-color: red;
    color: white;
    display: inline;
    padding: 2px;
    border-radius: 3px;
    cursor: pointer;
}
</style>