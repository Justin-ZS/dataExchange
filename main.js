const plugin = {
    update(data) {
        const text = document.createTextNode(data);
        document.body.appendChild(text);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (data === 'error') return reject('error');
                return resolve('echo:' + data);
            }, 2000)
        })
    }
}

window.plugin = plugin;