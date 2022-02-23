const fs = require('fs');
const superagent = require('superagent');

const cookie = fs.readFileSync('cookie.txt').toString().trim();

let globals = {
    csrf: 'abcdefg',
    totalArchived: 0,
    page: 0,
    totalPages: 0
}

const getRecentInboxPage = () => new Promise(resolve => {
    superagent('GET', 'https://privatemessages.roblox.com/v1/messages?messageTab=inbox&pageNumber=' + globals.page + '&pageSize=9999999')
    .set('cookie', `.ROBLOSECURITY=${cookie}`)
    .set('content-type', 'application/json')
    .then(resp => {
        const {collection} = resp.body;
        if (!collection) return resolve([]);

        globals.totalPages = resp.body.totalPages;
        if (globals.page <= 0) globals.page = globals.totalPages;

        resolve(resp.body?.collection || []);
    })
    .catch(err => {
        if (err.response && err.response.status) {
            if (err.response.status === 401) {
                console.log('invalid roblox cookie')
                process.exit();
            }
        }

        console.error(err);

        resolve([]);
    })
});

const deleteInboxMessages = (messageIds) => new Promise(resolve => {
    const body = { messageIds };

    superagent('POST', 'https://privatemessages.roblox.com//v1/messages/archive')
    .set('cookie', `.ROBLOSECURITY=${cookie}`)
    .set('x-csrf-token', globals.csrf)
    .set('content-type', 'application/json')
    .send(body)
    .then(resp => {
        globals.totalArchived += messageIds.length;
        console.log(`Deleted [${messageIds.length}] inbox messages, [${globals.totalArchived.toLocaleString()}] cleared.`)
        resolve();
    })
    .catch(err => {
        if (err.response && err.response.status) {
            if (err.response.status === 401) {
                console.log('invalid roblox cookie')
                process.exit();
            } else if (err.response.status === 403) {
                globals.csrf = err.response.headers['x-csrf-token'] || globals.csrf;
                console.log(`Updated CSRF to [${globals.csrf}]`);

                return resolve(deleteInboxMessages(messageIds))
            }
        }

        console.error(err);

        resolve([]);
    })
})

const main = async () => {
    for (;;) {
        if (globals.page < 0) return;

        const inboxMessages = await getRecentInboxPage();
        globals.page--;

        let messageIdsToDelete = [];
        for (const message of inboxMessages) {
            if (!message.isSystemMessage) continue;
            if (
                message.subject.indexOf('You have a Trade request from ') < 0 &&    // New trade request
                message.subject.indexOf('Your trade with ') < 0 &&                  // Trade ended
                message.subject.indexOf(' completed!') < 0 &&                       // Completed trade
                message.subject.indexOf('has countered your Trade.') < 0 &&         // Trade countered
                message.subject.indexOf(' could not be completed.') < 0             // Trade rejected
            ) continue;
            
            messageIdsToDelete.push(message.id);
        }
    
        deleteInboxMessages(messageIdsToDelete);
    }
}

main();
