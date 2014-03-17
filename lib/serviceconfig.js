
module.exports = function() {

	var cfg = {
		name: "",
		root: false,
        svclog: process.env.HOME + "/svclog/service.log",
        appdir: "",
		daemon: {
            name: '',
            pidfile: '',
            user: '',
            group: '',
            silent: true
		},
		app: {
            autorestart: 0,
            ipcsock: '',
			config: [],
			flavour: []
		}
	};
	
	return cfg;
};
