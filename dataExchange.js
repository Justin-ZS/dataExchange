(function() {
  const createTask = () => {
    let task = {};
    task.promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });
    return task;
  }

  const msg = {
    create: (id, content) => ({ id, content }),
    getContent: ({ content }) => content,
    getId: ({ id }) => id,
  }

  const createRandomString = () => (Math.random() + 1).toString(36).substring(7);

  const isFunction = target => typeof target == 'function';
  const isPromise = (target = {}) => isFunction(target.then);

  class ExchangerBase {
    constructor() {
      this.handlers = [];
      this.pendingTasks = {};
      this.receiveMsg = this.receiveMsg.bind(this);
      this.init();
    }
    // init/uninit exchanger environment
    init(target = window) {
      target.addEventListener('message', this.receiveMsg);
    }

    uninit(target = window) {
      target.removeEventListener('message', this.receiveMsg);
    }
    // send/receive message to/from target
    sendMsg(target, message) {
      target.postMessage(message, '*');
    }

    postMsg(target, content) {
      const msgId = createRandomString();
      // add task
      const task = createTask();
      this.pendingTasks[msgId] = task;
      task.promise.finally(() => {
        delete this.pendingTasks[msgId];
      })
      // send message
      const request = msg.create(msgId, content);
      this.sendMsg(target, request);

      return task.promise;
    }

    receiveMsg(event) {
      const message = event.data;
      const msgId = msg.getId(message);
      if (!msgId) return;

      const task = this.pendingTasks[msgId];
      if (task) {
        // this is a response
        const content = msg.getContent(message);
        if (content.isError) task.reject(content.payload);
        else task.resolve(content.payload);
      } else {
        // this is a request
        const sendRes = (res) => {
          const response = msg.create(msgId, res);
          const sender = event.source;
          this.sendMsg(sender, response)
        }
        this.msgHandler(msg.getContent(message))
          .then(result => sendRes({ isError: false, payload: result }))
          .catch(error => sendRes({ isError: true, payload: error }));
      }
    }
    // add/remove message handler
    addHandler(fn) {
      this.handlers.push(fn);
      return this;
    }

    removeHandler(fn) {
      const idx = this.handlers.findIndex(h => this.isEqual(h, fn));
      if (idx === -1) {
        return console.error("No matched handler!");
      }
      this.handlers.splice(idx, 1);
      return this;
    }
    // call correspond handler
    isEqual(fn1, fn2) {
      return fn1 === fn2;
    }

    handlerTest(content) {
      return function (handler) {
        if (handler.match && isFunction(handler.match)) {
          return handler.match(content);
        }
        return true;
      }
    }

    msgHandler(content) {
      const matchedHandlers = this.handlers.filter(this.handlerTest(content));
      const getCallback = cb => isFunction(cb) ? cb : cb.handle;

      if (matchedHandlers.length === 0) {
        return Promise.reject("Nothing handle the message");
      } else if (matchedHandlers.length === 1) {
        const callback = getCallback(matchedHandlers[0])
        const result = callback(content);
        if (isPromise(result)) return result;
        return Promise.resolve(result);
      } else {
        return Promise.all(matchedHandlers.map(h => getCallback(h)(content)));
      }
    }
  }

  class Exchanger extends ExchangerBase {
    constructor(options = {}) {
      super();
      this.target = options.receiver;
    }

    send(type, message = '') {
      if (!this.target) {
        return new Error("Must specified a target with send method!");
      }
      return this.postMsg(this.target, { type, message })
    }

    send2(target, type, message = '') {
      return this.postMsg(target, { type, message })
    }

    on(type, fn) {
      const handler = {
        match: msg => msg.type === type,
        handle: msg => fn(msg.message),
        type,
        origin: fn,
      }
      return this.addHandler(handler)
    }

    off(type, fn) {
      return this.removeHandler({
        type,
        origin: fn,
      })
    }

    isEqual(fn1, fn2) {
      return fn1.type === fn2.type && fn1.origin === fn2.origin;
    }

  }

  window.Exchanger = Exchanger;
})()