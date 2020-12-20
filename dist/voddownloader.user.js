// ==UserScript==
// @name           Skrypt umożliwiający pobieranie materiałów ze znanych serwisów VOD.
// @version        6.2.1
// @updateURL      https://raw.githubusercontent.com/zacny/voddownloader/master/dist/voddownloader.meta.js
// @downloadURL    https://raw.githubusercontent.com/zacny/voddownloader/master/dist/voddownloader.user.js
// @description    Skrypt służący do pobierania materiałów ze znanych serwisów VOD.
//                 Działa poprawnie tylko z rozszerzeniem Tampermonkey.
//                 Cześć kodu pochodzi z:
//                 miniskrypt.blogspot.com,
//                 miniskrypt.hubaiitv.pl
// @author         Przmus, zacny
// @namespace      http://www.ipla.tv/
// @source         https://github.com/zacny/voddownloader
// @include        https://vod.tvp.pl/video/*
// @include        /^https://(bialystok|katowice|lodz|rzeszow|bydgoszcz|kielce|olsztyn|szczecin|gdansk|krakow|opole|warszawa|gorzow|lublin|poznan|wroclaw).tvp.pl/\d{6,}/
// @include        https://cyfrowa.tvp.pl/video/*
// @include        https://www.ipla.tv/*
// @include        https://player.pl/*
// @include        https://*.cda.pl/*
// @include        https://vod.pl/*
// @include        https://redir.atmcdn.pl/*
// @include        https://*.redcdn.pl/file/o2/redefine/partner/*
// @include        https://video.wp.pl/*
// @include        https://ninateka.pl/*
// @include        https://www.arte.tv/*/videos/*
// @include        https://pulsembed.eu/*
// @exclude        http://www.tvp.pl/sess/*
// @exclude        https://www.cda.pl/iframe/*
// @grant          GM_getResourceText
// @grant          GM_xmlhttpRequest
// @grant          GM_download
// @grant          GM_setClipboard
// @grant          GM_info
// @connect        tvp.pl
// @connect        getmedia.redefine.pl
// @connect        player-api.dreamlab.pl
// @connect        api.arte.tv
// @connect        b2c.redefine.pl
// @run-at         document-end
// @require        https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require        https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.3.1/js/bootstrap.min.js
// @require        https://cdnjs.cloudflare.com/ajax/libs/platform/1.3.5/platform.min.js
// @require        https://gitcdn.xyz/cdn/zacny/voddownloader/4b17a120f521eaddf476d6e8fe3be152d506f244/lib/js/mdb-with-waves-patch.js
// @resource       buttons_css https://raw.githubusercontent.com/zacny/voddownloader/master/lib/css/voddownloader-buttons.css
// @resource       content_css https://raw.githubusercontent.com/zacny/voddownloader/master/lib/css/voddownloader-content.css
// ==/UserScript==

(function vodDownloader($, platform, Waves) {
    'use strict';

    function Exception(error, templateParams) {
	    this.error = error;
	    this.templateParams = Array.isArray(templateParams) ? templateParams : [templateParams];
	}
	
	function Format(data) {
	    this.bitrate = null;
	    this.format = null;
	    $.extend(true, this, data);
	}
	
	var Tool = (function(Tool) {
	    Tool.deleteParametersFromUrl = function(url){
	        return decodeURIComponent(url.replace(/\?.*/,''));
	    };
	
	    Tool.getUrlParameter = function(paramName, url){
	        var results = new RegExp('[\?&]' + paramName + '=([^&#]*)').exec(url);
	        if (results==null) {
	            return null;
	        }
	        return decodeURIComponent(results[1]) || 0;
	    };
	
	    Tool.formatConsoleMessage = function(message, params){
	        console.log.apply(this, $.merge([message], params));
	    };
	
	    Tool.downloadFile = function(fileUrl, title){
	        var extension = Tool.deleteParametersFromUrl(fileUrl.split('.').pop());
	        var movieTitle = (title !== undefined && title !== '' ) ? title : 'nieznany';
	        var name = movieTitle + '.' + extension;
	        GM_download(fileUrl, name);
	    };
	
	    Tool.template = function(templates, ...keys){
	        return (function(...values) {
	            var dict = values[values.length - 1] || {};
	            var result = [templates[0]];
	            keys.forEach(function(key, i) {
	                var value = Number.isInteger(key) ? values[key] : dict[key];
	                result.push(value, templates[i + 1]);
	            });
	            return result.join('');
	        });
	    };
	
	    Tool.getRealUrl = function(){
	        var topUrl = window.sessionStorage.getItem(config.storage.topWindowLocation);
	        return topUrl !== null ? topUrl : window.location.href;
	    };
	
	    Tool.isTopWindow = function(){
	        return window.top === window.self;
	    };
	
	    return Tool;
	}(Tool || {}));
	
	const config = {
	    attempts: 10,
	    attemptTimeout: 1500,
	    storage: {
	        doNotWarn: 'voddownloader.doNotwarnIfIncorrectPluginSettingsDetected',
	        topWindowLocation: 'voddownloader.topWindowLocation'
	    },
	    include: {
	        fontawesome: {
	            id: 'fontawesome',
	            css: 'https://use.fontawesome.com/releases/v5.8.2/css/all.css'
	        },
	        bootstrap: {
	            id: 'bootstrap',
	            css: 'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.3.1/css/bootstrap.min.css'
	        },
	        mdb: {
	            id: 'mdb',
	            css: 'https://cdnjs.cloudflare.com/ajax/libs/mdbootstrap/4.8.2/css/mdb.min.css',
	        }
	    },
	    error: {
	        id: {
	            caption: 'Nie udało się odnaleźć idetyfikatora.',
	            template: Tool.template`Algorytm rozpoznawania identyfikatora wideo na stronie: ${0} \
	                zakończył się niepowodzeniem. Może to oznaczać błąd skryptu.`,
	        },
	        tvnId: {
	            caption: 'Nie udało się odnaleźć idetyfikatora.',
	            template: Tool.template`Algorytm rozpoznawania identyfikatora wideo na stronie: ${0} \
	                zakończył się niepowodzeniem.\nJeżeli jest to główna strona programu oznacza to, \
	                że nie udało się odnaleźć identyfikatora ostatniego odcinka. Wejdź na stronę odcinka \
	                i spróbuj ponownie.\nMoże to również oznaczać błąd skryptu.`,
	        },
	        call: {
	            caption: 'Błąd pobierania informacji o materiale.',
	            template: Tool.template`Wystąpił błąd w wykonaniu skryptu w kroku: ${0} na stronie: ${1} \
	                Zgłoś problem autorom skryptu.`,
	        },
	        noSource: {
	            caption: 'Nie udało się odnaleźć źródeł do materiału.',
	            template: Tool.template`Materiał ze strony ${0} nie posiada zdefiniowanych źródeł, które mogłyby zostać \
	                wyświetlone. \nMoże to oznaczać, że nie jest on publicznie dostępny, dostępne źródła nie mogą zostać \
	                wyświetlone w przeglądarce bez dodatkowego oprogramowania lub jest umieszczony w płatnej strefie.`,
	            type: 'info'
	        },
	        timeout: {
	            caption: 'Zbyt długi czas odpowiedzi.',
	            template: Tool.template`Dla kroku: ${0} na stronie "${1}" nie dotarły \
	                informacje zwrotne.\nPrzypuszczalnie jest to problem sieciowy. Spróbuj ponownie za jakiś czas.`
	        },
	        noParent: {
	            caption: 'Brak zakładki ze stroną główną.',
	            template: Tool.template`Została zamknięta zakładka ze stroną na której został uruchomiony skrypt. \
	                    Ta zakładka nie może przez to działać poprawnie. Otwórz ponownie stronę główną: \n ${0} \n
	                    by przywrócić prawidłowe funkcjonowanie skryptu.`
	        }
	    }
	};
	
	
	function Step(properties){
	    var step = {
	        urlTemplate: '',
	        beforeStep: function(input){return input},
	        afterStep: function (output) {return output},
	        resolveUrl: function (input) {
	            var url = this.urlTemplate;
	            var urlParams = {};
	            $.each(input, function (key, value) {
	                url = url.replace(new RegExp('#'+key,'g'), value);
	                urlParams[key] = value;
	            });
	
	            return {
	                url: url,
	                urlParams: urlParams
	            };
	        },
	        isAsync: function(){
	            return step.urlTemplate;
	        },
	        method: 'GET',
	        methodParam: function(){return {}}
	    };
	
	    return $.extend(true, step, properties);
	}
	
	var Notification = (function(Notification) {
	    var create = function(title, bodyContent, special) {
	        var specialContentClasses = special ? ' special-color white-text' : '';
	        var content = $('<div>').addClass('toast notification' + specialContentClasses).attr('role', 'alert')
	            .attr('aria-live', 'assertive').attr('aria-atomic', 'true')
	            .attr('name', special ? 'special' : 'normal').attr('data-delay', '5000');
	        var header = $('<div>').addClass('toast-header special-color-dark white-text');
	        var warnIcon = $('<i>').addClass('fas fa-exclamation-triangle pr-2');
	        var notificationTitle = $('<strong>').addClass('mr-auto').text(title);
	        var time = $('<small>').text(new Date().toLocaleTimeString());
	        var close = $('<button>').attr('type', 'button').addClass('ml-2 mb-1 close white-text')
	            .attr('data-dismiss', 'toast').attr('aria-label', 'Close')
	            .append($('<span>').attr('aria-hidden', 'true').text('\u00D7'));
	
	        if(special){
	            header.append(warnIcon);
	            content.attr('data-autohide', 'false');
	        }
	        header.append(notificationTitle).append(time).append(close);
	        var body = $('<div>').addClass('toast-body notification-body').append(bodyContent);
	
	        content.append(header).append(body);
	        return content;
	    };
	
	    Notification.show = function(options, w){
	        options = options || {};
	        var special = false;
	        if (options.hasOwnProperty('special')) {
	            special = options.special;
	        }
	        if(!options.hasOwnProperty('title') || !options.hasOwnProperty('content')){
	            return;
	        }
	
	        var rootElement = $(w.document.body);
	        var notification = create(options.title, options.content, special);
	        $('#notification-container', rootElement).append(notification);
	        $('.toast', rootElement).toast('show');
	        $('.toast', rootElement).on('hidden.bs.toast', function (){
	            $.each($(this), function(index, value) {
	                var element = $(value);
	                element.remove();
	            });
	        })
	    };
	
	    return Notification;
	}(Notification || {}));
	
	var PluginSettingsDetector = (function(PluginSettingsDetector){
	    var prepareWarningNotification = function(w) {
	        var bodyContent = $('<div>')
	            .append('Twój dodatek ma nieprawidłowe ustawienia, przez co nie możesz korzystać z opcji ')
	            .append('bezpośredniego pobierania plików. Możesz skorygować je w następujący sposób:');
	        var list = $('<ol>').addClass('m-0')
	            .append($('<li>').text('Otwórz Panel sterowania Tampermonkey i kliknij ustawienia.'))
	            .append($('<li>').text('Ogólne > Tryb konfiguracji > Expert'))
	            .append($('<li>').text('Pobieranie BETA > Tryb pobierania > API przeglądarki'))
	            .append($('<li>').text('Zapisz ustawienia, a jeżeli przeglądarka zapyta o możliwość zarządzania' +
	                ' pobieranymi plikami, należy się zgodzić'));
	        bodyContent.append(list).append(createButton(w));
	        var options = {title: 'Wykryto problem', content: bodyContent, special: true};
	        Notification.show(options, w);
	    };
	
	    var createButton = function(w){
	        return $('<button>').attr('type', 'button').addClass('btn btn-dark btn-sm m-1 pl-3 pr-3')
	            .append($('<i>').addClass('fas pr-1 fa-window-close')).append('Nie pokazuj więcej').click(function(){
	                var rootElement = $(w.document.body);
	                w.localStorage.setItem(config.storage.doNotWarn, true);
	                $('.toast.special-color', rootElement).toast('hide');
	                setTimeout(function(){
	                    $('.toast.special-color', rootElement).remove();
	                }, 1000);
	            });
	    };
	
	    var disableDownload = function(w){
	        var rootElement = $(w.document.body);
	        $('.fa-save', rootElement).closest('button').attr('disabled', true);
	    };
	
	    PluginSettingsDetector.detect = function(w){
	        var downloadMode = GM_info.downloadMode;
	        if(downloadMode !== 'browser'){
	            disableDownload(w);
	            var value = w.localStorage.getItem(config.storage.doNotWarn);
	            if(value !== 'true'){
	                prepareWarningNotification(w);
	            }
	        }
	    };
	    return PluginSettingsDetector;
	}(PluginSettingsDetector || {}));
	
	var DomTamper = (function(DomTamper){
	
	    DomTamper.injectStyle = function(w, name){
	        var head = $(w.document.head);
	        if(!head.find('style[name="' + name + '"]').length){
	            var styleElement = $('<style>').attr('type', 'text/css')
	                .attr('name', name).text((GM_getResourceText(name)));
	            head.append(styleElement);
	        }
	    };
	
	    var injectStylesheet = function (w, setting) {
	        var head = $(w.document.head);
	        if(!head.find('link[name="' + setting.id + '"]').length){
	            var stylesheet = $('<link>').attr('name', setting.id).attr('type', 'text/css').attr('rel', 'stylesheet')
	                .attr('href', setting.css);
	            head.append(stylesheet);
	        }
	    };
	
	    var prepareHead = function(w){
	        injectStylesheet(w, config.include.fontawesome);
	        injectStylesheet(w, config.include.bootstrap);
	        injectStylesheet(w, config.include.mdb);
	        DomTamper.injectStyle(w, 'content_css');
	    };
	
	    var createBugReportLink = function(w, additionalClass){
	        var button = $('<button>').attr('id', 'bug-report-button').attr('type', 'button')
	            .addClass('btn btn-sm m-0').addClass(additionalClass)
	            .append($('<i>').addClass('fas fa-bug'));
	        button.click(function(){
	            w.open('https://github.com/zacny/voddownloader/issues');
	        });
	        return $('<div>').addClass('bug-report-position').append(button);
	    };
	
	    var prepareBody = function(w, pageContent, detection) {
	        appendOrReplace(w, pageContent);
	        attachWaveEffect(w, pageContent);
	        if(detection) {
	            PluginSettingsDetector.detect(w);
	        }
	    };
	
	    var appendOrReplace = function (w, pageContent) {
	        var body = $(w.document.body);
	        if(body.children().length > 0){
	            body.children(":first").replaceWith(pageContent);
	        }
	        else {
	            body.append(pageContent);
	        }
	    };
	
	    var attachWaveEffect = function(w, pageContent){
	        var buttons = pageContent.find('.btn:not(.btn-flat), .btn-floating');
	        Waves.attach(buttons, ['waves-light']);
	        Waves.init({}, w);
	    };
	
	    DomTamper.handleError = function(exception, w){
	        if(w === undefined){
	            w = window.open();
	        }
	
	        prepareHead(w);
	        var errorData = getErrorData(exception);
	        var pageContent = $('<div>').addClass('page-content');
	        pageContent.append(createErrorContent(errorData));
	        pageContent.append(createBugReportLink(w, errorData.type === 'error' ?
	            'btn-danger' : 'special-color white-text'));
	        prepareBody(w, pageContent);
	    };
	
	    var getErrorData = function(exception){
	        var type = 'error';
	        var caption = 'Niespodziewany błąd';
	        var message = 'Natrafiono na niespodziewany błąd: ' + exception;
	        if(exception.error){
	            message = exception.error.template.apply(this, exception.templateParams).replace(/\n/g, '<br/>');
	            caption = exception.error.caption;
	            type = exception.error.type !== undefined ? exception.error.type : 'error';
	        }
	
	        return {
	            message: linkify(message),
	            caption: caption,
	            type: type
	        }
	    };
	
	    var linkify = function(text) {
	        var linkDetectionRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
	        return text.replace(linkDetectionRegex, function(url) {
	            return '<u><a class="text-white" href="' + url + '">' + url + '</a></u>';
	        });
	    };
	
	    var createErrorContent = function(errorData){
	        var typeClass = errorData.type === 'error' ? 'bg-danger' : 'bg-dark';
	        var card = $('<div>').addClass('card text-white mb-3').addClass(typeClass);
	        var cardHeader = $('<div>').addClass('card-header')
	            .text('Niestety natrafiono na problem, który uniemożliwił dalsze działanie');
	        var cardBody = $('<div>').addClass('card-body')
	            .append($('<h5>').addClass('card-title').text(errorData.caption))
	            .append($('<div>').addClass('card-text text-white mb-3').append(errorData.message))
	            .append($('<div>').addClass('card-text text-white')
	                .append('Informacje o systemie: ').append(platform.description))
	            .append($('<div>').addClass('card-text text-white')
	                .append('Wersja pluginu: ').append(GM_info.version));
	        card.append(cardHeader).append(cardBody);
	        return card;
	    };
	
	    DomTamper.createButton = function(properties){
	        properties.wrapper.get().find('#'+properties.button.id).remove();
	        var button = $('<input>').attr('id', properties.button.id).attr('type', 'button')
	            .attr('style', properties.button.style).attr('value', 'Pobierz video').addClass(properties.button.class);
	        button.bind('click', properties.button.click);
	        properties.wrapper.get().append(button);
	    };
	
	    DomTamper.createLoader = function(w){
	        prepareHead(w);
	        var pageContent = $('<div>').addClass('page-content');
	        pageContent.append(createLoaderContent());
	        pageContent.append(createBugReportLink(w, 'special-color white-text'));
	        prepareBody(w, pageContent);
	        Unloader.init(w);
	    };
	
	    var createLoaderContent = function(){
	        var card = $('<div>').addClass('card text-white bg-dark');
	        var cardHeader = $('<div>').addClass('card-header').text('Poczekaj trwa wczytywanie danych...');
	        var cardBody = $('<div>').addClass('card-body');
	        var bodyContainer = $('<div>').addClass('d-flex justify-content-center m-3');
	        var spinner = $('<div>').addClass('spinner-border spinner-size').attr('role', 'status')
	            .append($('<span>').addClass('sr-only').text('Loading...'));
	        cardBody.append(bodyContainer.append(spinner));
	        card.append(cardHeader).append(cardBody);
	
	        return card;
	    };
	
	    var setWindowTitle = function(data, w){
	        var head = $(w.document.head);
	        var title = head.find('title');
	        if(title.length) {
	            title.text(data.title);
	        }
	        else {
	            head.append($('<title>').text(data.title));
	        }
	    };
	
	    DomTamper.createDocument = function(data, w){
	        prepareHead(w);
	        setWindowTitle(data, w);
	        var pageContent = $('<div>').addClass('page-content');
	        pageContent.append(Accordion.create(w, data));
	        pageContent.append(createBugReportLink(w, 'special-color white-text'));
	        pageContent.append(createNotificationContainer());
	        prepareBody(w, pageContent, true);
	        Unloader.init(w);
	        Accordion.bindActions(w, data);
	    };
	
	    var createNotificationContainer = function(){
	        return $('<div>').attr('id', 'notification-container')
	            .attr('aria-live', 'polite').attr('aria-atomic', 'true').addClass('notification-container');
	    };
	
	    return DomTamper;
	}(DomTamper || {}));
	
	var Accordion = (function(Accordion) {
	    Accordion.create = function(w, data){
	        var mainCardTitle = $('<div>').addClass('card-header').text(data.title);
	
	        var accordion = $('<div>').addClass('accordion md-accordion').attr('id', 'accordion')
	            .attr('role', 'tablist').attr('aria-multiselectable', 'true');
	
	        createCards(accordion, data);
	
	        var mainCardBody = $('<div>').addClass('card-body p-0').append(accordion);
	        return $('<div>').addClass('card').append(mainCardTitle).append(mainCardBody);
	    };
	
	    var createCards = function(accordion, data) {
	        for(var key in data.cards) {
	            var card = createCard({
	                card: data.cards[key],
	                key: key,
	                title: data.title
	            });
	            accordion.append(card);
	        }
	    };
	
	    var createCard = function(data){
	        var accordionCard = $('<div>').addClass('border border-top-0');
	        var content = $('<div>').addClass('card-body pt-0');
	
	        var badgeClass = 'badge-light';
	        var textMuted = 'text-muted';
	        if(data.card.items.length > 0){
	            badgeClass = 'badge-danger';
	            textMuted = 'text-dark';
	            content.append(createCardContent(data));
	        }
	
	        var icon = $('<i>').addClass('fas').addClass(data.card.icon).addClass('pr-2');
	        var badge = $('<span>').addClass('badge mr-3 float-right').addClass(badgeClass)
	            .text(data.card.items.length);
	        var cardTitle = $('<h6>').addClass('mb-0').addClass(textMuted).append(icon).append(badge)
	            .append($('<span>').text(data.card.label));
	        var link = $('<a>').append(cardTitle);
	        var cardHeader = $('<div>').addClass('ml-3 p-2').attr('role', 'tab').attr('id', data.key).append(link);
	
	        var cardBody = $('<div>').addClass('collapse').attr('role', 'tabpanel')
	            .attr('aria-labelledby', data.key).append(content);
	        if(data.card.collapse){
	            cardBody.addClass('show');
	        }
	
	        accordionCard.append(cardHeader);
	        accordionCard.append(cardBody);
	        return accordionCard;
	    };
	
	    var createCardContent = function(data){
	        var table = $('<table>').addClass('table table-bordered table-striped btn-table');
	        var tbody = $('<tbody>');
	        table.append(tbody);
	        createRows(tbody, data);
	
	        return table;
	    };
	
	    var createRows = function(tableBody, data){
	        data.card.items.forEach(function(item) {
	            tableBody.append(createRow({
	                item: item,
	                info: data.card.info,
	                title: data.title,
	                actions: data.card.actions
	            }));
	        });
	    };
	
	    var createRow = function(data){
	        var actions = $('<td>').attr('scope', 'row').addClass('action-row-' + data.actions.length);
	        data.actions.forEach(function(action){
	            actions.append(createButton(action, data));
	        });
	
	        var description = $('<td>').html(createDescriptionHtml(data));
	        return $('<tr>').append(actions).append(description);
	    };
	
	    var createDescriptionHtml = function(data){
	        var descriptionHtml = $('<div>');
	
	        createDescription(data).forEach(function(item, idx, array){
	            descriptionHtml.append($('<b>').text(item.desc + ': '))
	                .append($('<span>').text(item.value));
	            if(idx !== array.length - 1) {//not last
	                descriptionHtml.append($('<span>').text(', '));
	            }
	        });
	        return descriptionHtml;
	    };
	
	    var itemExist = function(data, info){
	        return data.item.hasOwnProperty(info.name) && data.item[info.name] != null
	    };
	
	    var createDescription = function(data){
	        var description = [];
	        data.info.forEach(function(info){
	            if (itemExist(data, info)) {
	                description.push({
	                    desc: info.desc,
	                    value: data.item[info.name]
	                });
	            }
	        });
	        return description;
	    };
	
	    var createButton = function(action, data){
	        return $('<button>').attr('type', 'button').attr('data-url', data.item.url).attr('data-title', data.title)
	            .addClass('btn btn-dark btn-sm m-1 pl-3 pr-3')
	            .append($('<i>').addClass('fas pr-1').addClass(action.icon)).append(action.label);
	    };
	
	    Accordion.bindActions = function(w, data){
	        cardActions(w, data);
	        buttonActions(w);
	    };
	
	    var cardActions = function(w, data){
	        for(var key in data.cards) {
	            var cardHeader = $(w.document.body).find('#' + key);
	            var disabled = cardHeader.find('h6.text-muted');
	            if(disabled.length){
	                disabled.addClass('cursor-normal');
	                return;
	            }
	
	            $(w.document.body).find('#' + key).click(function() {
	                var id = $(this).attr('id');
	                $(w.document.body).find('div[aria-labelledby="' + id + '"]').toggle();
	            });
	        }
	    };
	
	    var buttonActions = function(w){
	        getButton(w, '.fa-clone').click(function(){ copyActionClick($(this), w) });
	        getButton(w, '.fa-film').click(function(){ openActionClick($(this), w) });
	        getButton(w, '.fa-download').click(function(){ downloadActionClick($(this), w) });
	    };
	
	    var getButton = function(w, iconClass){
	        return $(w.document.body).find(iconClass).parent();
	    };
	
	    var downloadActionClick = function (element, w) {
	        var options = {title: 'Rozpoczęto pobieranie pliku', content: element.attr('data-title')};
	        Tool.downloadFile(element.attr('data-url'), element.attr('data-title'));
	        Notification.show(options, w);
	    };
	
	    var copyActionClick = function (element, w) {
	        GM_setClipboard(element.attr('data-url'));
	        var options = {title: 'Kopiowanie', content: 'Skopiowano do schowka'};
	        Notification.show(options, w);
	    };
	
	    var openActionClick = function (element, w) {
	        w.open(element.attr('data-url'));
	    };
	
	    return Accordion;
	}(Accordion || {}));
	
	var Executor = (function(Executor){
	    var execute = function(service, options, w){
	        var setup = setupStep(service, options);
	        logStepInfo(options, setup);
	        if(setup.isAsync){
	             executeAsync(service, setup, options, w);
	        }
	        else {
	            options.temporaryData = {};
	            callback(service, options, w);
	        }
	    };
	
	    var executeAsync = function(service, setup, options, w){
	        var chain = options.chainNames[options.chainIndex];
	        var chainStep = chain + '[' + options.stepIndex + ']';
	        var exceptionParams = [chainStep, Tool.getRealUrl()];
	        var requestParams = {
	            method: setup.method,
	            url: setup.resolveUrl.url,
	            data: JSON.stringify(setup.methodParam),
	            responseType: 'json',
	            onload: function(data) {
	                options.temporaryData = data.response || {};
	                callback(service, options, w);
	            },
	            onerror: function(){
	                DomTamper.handleError(new Exception(config.error.call, exceptionParams), w);
	            },
	            ontimeout: function(){
	                DomTamper.handleError(new Exception(config.error.timeout, exceptionParams), w);
	            }
	        };
	        GM_xmlhttpRequest(requestParams);
	    };
	
	    var logStepInfo = function(options, setup){
	        var chain = options.chainNames[options.chainIndex];
	        var step = chain + '[' + options.stepIndex + ']';
	        var stepParams = $.isEmptyObject(setup.methodParam) ? '' : JSON.stringify(setup.methodParam);
	        var params = [
	            'color:blue', step,  'color:red', setup.method, 'color:black;font-weight: bold',
	            setup.resolveUrl.url, 'color:magenta', stepParams
	        ];
	        Tool.formatConsoleMessage('%c%s%c %s %c %s %c%s', params);
	    };
	
	    var setupStep = function(service, options){
	        var currentStep = getCurrentStep(service, options);
	        var result = currentStep.beforeStep(options.temporaryData);
	        if(typeof result === 'string' || typeof result == 'number'){
	            result = {
	                videoId: result
	            }
	        }
	        if(options.urlParams){
	            $.extend(true, options.urlParams, result);
	        }
	        else {
	            options.urlParams = result;
	        }
	
	        return {
	            resolveUrl: currentStep.resolveUrl(options.urlParams),
	            method: currentStep.method,
	            methodParam: currentStep.methodParam(),
	            isAsync: currentStep.isAsync()
	        };
	    };
	
	    var getCurrentStep = function(service, options){
	        var chain = options.chainNames[options.chainIndex];
	        var steps = service.asyncChains[chain];
	        return steps[options.stepIndex];
	    };
	
	    var hasNextStep = function(service, options){
	        var chain = options.chainNames[options.chainIndex];
	        var steps = service.asyncChains[chain];
	        return steps.length - 1 > options.stepIndex;
	    };
	
	    var hasNextChain = function(service, options){
	        return options.chainNames.length - 1 > options.chainIndex;
	    };
	
	    var setChainResult = function(options){
	        var chain = options.chainNames[options.chainIndex];
	        if(!options.hasOwnProperty('results')){
	            options.results = {};
	        }
	        var chainResult = options.results;
	        chainResult[chain] = options.temporaryData;
	        options.temporaryData = {};
	    };
	
	    var pushChain = function(service, options){
	        setChainResult(options);
	        if(hasNextChain(service, options)){
	            options.chainIndex += 1;
	            options.stepIndex = 0;
	            return true;
	        }
	        return false;
	    };
	
	    var pushStep = function(service, options) {
	        if(hasNextStep(service, options)){
	            options.stepIndex += 1;
	            return true;
	        }
	        return false;
	    };
	
	    var afterStep = function(service, options) {
	        var currentStep = getCurrentStep(service, options);
	        var output = currentStep.afterStep(options.temporaryData);
	        options.temporaryData = output;
	    };
	
	    var callback = function(service, options, w){
	        try {
	            afterStep(service, options);
	            if(pushStep(service, options) || pushChain(service, options)) {
	                return Promise.resolve().then(
	                    Executor.chain(service, options, w)
	                );
	            }
	            else {
	                return Promise.resolve().then(
	                    service.onDone(options.results, w)
	                );
	            }
	        }
	        catch(e){
	            DomTamper.handleError(e, w);
	        }
	    };
	
	    Executor.chain = function(service, options, w){
	        try {
	            if(w === undefined){
	                w = window.open();
	                DomTamper.createLoader(w);
	            }
	
	            execute(service, options, w);
	        }
	        catch(e){
	            DomTamper.handleError(e, w);
	        }
	    };
	
	    return Executor;
	}(Executor || {}));
	
	function Configurator(properties){
	    var service = {
	        wrapper: {
	            selector: '',
	            get: function(){
	                return $(service.wrapper.selector);
	            },
	            exist: function(){
	                return $(service.wrapper.selector).length > 0;
	            }
	        },
	        button: {
	            id: 'direct-download',
	            style: '',
	            class: '',
	            click: function(){
	                var chainNames = service.chainSelector();
	                Executor.chain(service, {
	                    stepIndex: 0,
	                    chainIndex: 0,
	                    chainNames: chainNames
	                });
	            }
	        },
	        cardsData: {
	            title: '',
	            cards: {
	                videos: {
	                    icon: 'fa-video', label: 'Video', collapse: true, items: [],
	                    info: [
	                        {name: 'bitrate', desc: 'bitrate'},
	                        {name: 'quality', desc: 'rozdzielczość'},
	                        {name: 'langDesc', desc: 'wersja językowa'}
	                    ],
	                    actions: [
	                        {label: 'Pobierz', icon: 'fa-download'},
	                        {label: 'Kopiuj', icon: 'fa-clone'},
	                        {label: 'Otwórz', icon: 'fa-film'}
	                    ]
	                },
	                subtitles: {
	                    icon: 'fa-file-alt', label: 'Napisy', collapse: false, items: [],
	                    info: [
	                        {name: 'description', desc: 'opis'},
	                        {name: 'format', desc: 'format'},
	                    ],
	                    actions: [
	                        {label: 'Pobierz', icon: 'fa-download'}
	                    ]
	                }
	            }
	        },
	        asyncChains: {
	            videos: []
	        },
	        chainSelector: function(){
	            return ['videos'];
	        },
	        formatter: function(data){
	            data.cards['videos'].items.sort(function (a, b) {
	                return b.bitrate - a.bitrate;
	            });
	            data.cards['subtitles'].items.sort(function (a, b) {
	                return ('' + a.format).localeCompare(b.format);
	            });
	        },
	        aggregate: function(data){
	            var aggregatedData = {};
	            $.extend(true, aggregatedData, service.cardsData);
	            var chains = service.chainSelector();
	            chains.forEach(function(chain){
	                 $.extend(true, aggregatedData, data[chain]);
	            });
	            return aggregatedData;
	        },
	        onDone: function(data, w) {
	            var aggregatedData = service.aggregate(data);
	            service.formatter(aggregatedData);
	            DomTamper.createDocument(aggregatedData, w);
	        }
	    };
	
	    return $.extend(true, service, properties);
	}
	
	function Detector(conf) {
	    var configuration = conf;
	
	    var logMessage = function(attempt){
	        var color = configuration.logStyle || 'color:black;font-weight:bold';
	        var existColor = configuration.success() ? 'color:green' : 'color:red';
	        if(configuration.unlimited){
	            var params = [
	                existColor, configuration.target, 'color:black'
	            ];
	            Tool.formatConsoleMessage('[%c%s%c]', params);
	        }
	        else {
	            var params = [
	                'color:black', color, configuration.target, 'color:black',
	                existColor + ';font-weight:bold', attempt, 'color:black'
	            ];
	            Tool.formatConsoleMessage('%c[%c%s%c] [%c%s%c]', params);
	        }
	    };
	
	    var check = function(attempt){
	        logMessage(attempt);
	        if (configuration.success()) {
	            return Promise.resolve().then(
	                configuration.successCallback()
	            );
	        } else if(configuration.unlimited || attempt > 0){
	            attempt = attempt-1;
	            return Promise.resolve().then(
	                setTimeout(check, config.attemptTimeout, attempt)
	            );
	        }
	    };
	
	    this.detect = function() {
	        check(config.attempts);
	    };
	}
	
	var ChangeVideoDetector = (function(ChangeVideoDetector){
	    ChangeVideoDetector.run = function(videoChangeCallback) {
	        var detector = new Detector({
	            unlimited: true,
	            previousLocation: window.location.href,
	            target: 'video-change',
	            success: function(){
	                return this.previousLocation !== window.location.href
	            },
	            successCallback: videoChangeCallback
	        });
	        detector.detect();
	    };
	    return ChangeVideoDetector;
	}(ChangeVideoDetector || {}));
	
	var WrapperDetector = (function(WrapperDetector){
	    WrapperDetector.run = function(properties, videoChangeCallback) {
	        var detector = new Detector({
	            logStyle: 'color:orange',
	            target: properties.wrapper.selector,
	            success: properties.wrapper.exist,
	            successCallback: function(){
	                DomTamper.createButton(properties);
	            }
	        });
	        detector.detect();
	
	        if(typeof videoChangeCallback === "function"){
	            ChangeVideoDetector.run(videoChangeCallback);
	        }
	    };
	    return WrapperDetector;
	}(WrapperDetector || {}));
	
	var ElementDetector = (function(ElementDetector){
	    ElementDetector.detect = function(selector, callback){
	        var detector = new Detector({
	            logStyle: 'color:dodgerblue',
	            target: selector,
	            success: function(){
	                return $(this.target).length > 0;
	            },
	            successCallback: callback
	        });
	        detector.detect();
	    };
	
	    return ElementDetector;
	}(ElementDetector || {}));
	
	var Unloader = (function(Unloader) {
	    var win;
	    var url;
	
	    Unloader.init = function(w){
	        win = w;
	        url = Tool.getRealUrl();
	        $(window).bind('beforeunload', function(){
	            if(!win.closed) {
	                DomTamper.handleError(new Exception(config.error.noParent, url), win);
	            }
	        });
	    };
	
	    return Unloader;
	}(Unloader || {}));
	
	var MessageReceiver = (function(MessageReceiver) {
	    var win;
	    var origin;
	    var callbackFunction;
	    var alreadyConfirmed = false;
	    var alreadyPosted = false;
	
	    var receiveMessage = function(event, callback){
	        if (event.origin !== origin) {
	            return;
	        }
	
	        var data = JSON.parse(event.data);
	        if(data.confirmation){
	            alreadyConfirmed = true;
	        }
	        else {
	            data.confirmation = true;
	            if(!alreadyPosted) {
	                window.removeEventListener('message', callbackFunction);
	                alreadyPosted = true;
	                postMessage(data);
	                callback(data);
	            }
	        }
	    };
	
	    var postMessage = function(data){
	        data = JSON.stringify(data);
	        win.postMessage(data, '*');
	    };
	
	    MessageReceiver.awaitMessage = function(object, callback){
	        initCommunication(object, callback);
	    };
	
	    var initCommunication = function(object, callback){
	        callbackFunction = function(e){
	            receiveMessage(e, callback);
	        };
	        window.addEventListener('message', callbackFunction);
	        win = getProperty(object, 'windowReference');
	        origin = getProperty(object, 'origin');
	    };
	
	    var getProperty = function(object, prop){
	        if(object.hasOwnProperty(prop)){
	            return object[prop];
	        }
	    };
	
	    MessageReceiver.postUntilConfirmed = function(object){
	        initCommunication(object);
	        isMessageConfirmed(config.attempts, getProperty(object, 'message'))
	    };
	
	    var isMessageConfirmed = function(attempt, message){
	        if (alreadyConfirmed || attempt <= 0) {
	            return Promise.resolve().then(function(){
	                window.removeEventListener('message', callbackFunction);
	                alreadyConfirmed = false;
	                if(attempt <= 0){
	                    console.warn("Nie udało się przekazać adresu z okna głównego.");
	                }
	            });
	        } else if(attempt > 0){
	            attempt = attempt-1;
	            postMessage(message);
	            return Promise.resolve().then(
	                setTimeout(isMessageConfirmed, config.attemptTimeout, attempt, message)
	            );
	        }
	    };
	
	    return MessageReceiver;
	}(MessageReceiver || {}));
	
	var VOD_TVP = (function(VOD_TVP) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: 'div.playerContainerWrapper'
	        },
	        button: {
	            class: 'video-block__btn tvp_vod_downlaod_button',
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://tvp.pl/pub/stat/videofileinfo?video_id=#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    }
	                }),
	                new Step({
	                    urlTemplate: 'https://www.tvp.pl/shared/cdn/tokenizer_v2.php?object_id=#videoId',
	                    beforeStep: function (json) {
	                        return getRealVideoId(json);
	                    },
	                    afterStep: function (output) {
	                        return VOD_TVP.grabVideoData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var idParser = function() {
	        var src = $('div.playerContainer').attr('data-id');
	        if(src !== undefined){
	            return {
	                videoId: src.split("/").pop()
	            };
	        }
	
	        throw new Exception(config.error.id, window.location.href);
	    };
	
	    var getRealVideoId = function(json){
	        var videoId = json.copy_of_object_id !== undefined ?
	            json.copy_of_object_id : json.video_id;
	        return {
	            videoId: videoId
	        };
	    };
	
	    VOD_TVP.grabVideoData = function(data){
	        var items = [];
	        if(data.status == 'OK' && data.formats !== undefined){
	            $.each(data.formats, function( index, value ) {
	                if(value.adaptive == false){
	                    items.push(new Format({
	                        bitrate: value.totalBitrate,
	                        url: value.url
	                    }));
	                }
	            });
	            return {
	                title: data.title,
	                cards: {videos: {items: items}}
	            }
	        }
	        throw new Exception(config.error.noSource, window.location.href);
	    };
	
	    VOD_TVP.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return VOD_TVP;
	}(VOD_TVP || {}));
	
	var CYF_TVP = (function(CYF_TVP) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: 'div.playerContainerWrapper'
	        },
	        button: {
	            class: 'tvp_cyf_downlaod_button'
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://www.tvp.pl/shared/cdn/tokenizer_v2.php?object_id=#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return VOD_TVP.grabVideoData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var idParser = function(){
	        var src = $('iframe#JS-TVPlayer').attr('src');
	        if(src !== undefined) {
	            return src.split("/").pop();
	        }
	        else {
	            var div = $('div.playerWidget');
	            if(div !== undefined){
	                return div.attr('data-video-id');
	            }
	        }
	
	        throw new Exception(config.error.id, window.location.href);
	    };
	
	    CYF_TVP.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return CYF_TVP;
	}(CYF_TVP || {}));
	
	var TVP_REG = (function(TVP_REG) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: 'div.js-video'
	        },
	        button: {
	            class: 'tvp_reg_download_button'
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://www.tvp.pl/shared/cdn/tokenizer_v2.php?object_id=#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return VOD_TVP.grabVideoData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var idParser = function(){
	        var dataId = $('div.js-video').attr('data-object-id');
	        if(dataId != undefined) {
	            return dataId;
	        }
	
	        throw new Exception(config.error.id, window.location.href);
	    };
	
	    TVP_REG.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return TVP_REG;
	}(TVP_REG || {}));
	
	var TVN = (function(TVN) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '#player-container'
	        },
	        button: {
	            class: 'btn btn-primary tvn_download_button'
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: '/api/?platform=ConnectedTV&terminal=Panasonic&format=json' +
	                        '&authKey=064fda5ab26dc1dd936f5c6e84b7d3c2&v=3.1&m=getItem&id=#videoId',
	                    beforeStep: function(input){
	                        return idParser();
	                    },
	                    afterStep: function(output) {
	                        return grabVideoData(output);
	                    }
	                })
	            ]
	        },
	        formatter: function(data){
	            var sortingOrder = {
	                'HD': 7,
	                'Bardzo wysoka': 6,
	                'Wysoka': 5,
	                'Standard': 4,
	                'Średnia': 3,
	                'Niska': 2,
	                'Bardzo niska': 1
	            };
	
	            data.cards['videos'].items.sort(function (a, b) {
	                return sortingOrder[b.quality] - sortingOrder[a.quality];
	            });
	        }
	    });
	
	    var idParser = function(){
	        var watchingNow = $('.watching-now').closest('.embed-responsive').find('.embed-responsive-item');
	        if(watchingNow.length > 0){
	            return watchingNow.attr('href').split(',').pop();
	        }
	
	        return episodeIdParser();
	    };
	
	    var episodeIdParser = function () {
	        var match = window.location.href.match(/odcinki,(\d+)\/.*,(\d+)/);
	        if(match && match[2]){
	            return match[2];
	        }
	
	        return serialIdParser();
	    };
	
	    var serialIdParser = function () {
	        var match = window.location.href.match(/odcinki,(\d+)/);
	        if(match && match[1]){
	            throw new Exception(config.error.tvnId, Tool.getRealUrl());
	        }
	
	        return vodIdParser();
	    };
	
	    var vodIdParser = function(){
	        var match = window.location.href.match(/,(\d+)/);
	        if(match && match[1]){
	            return match[1];
	        }
	
	        throw new Exception(config.error.tvnId, Tool.getRealUrl());
	    };
	
	    var grabVideoData = function(data){
	        var items = [];
	        var video_content = (((data.item || {}).videos || {}).main || {}).video_content || {};
	        if(video_content && video_content.length > 0){
	            $.each(video_content, function( index, value ) {
	                items.push(new Format({
	                    quality: value.profile_name,
	                    url: value.src !== undefined ? value.src : value.url
	                }));
	            });
	
	            return {
	                title: getTitle(data),
	                cards: {videos: {items: items}}
	            }
	        }
	        throw new Exception(config.error.noSource, Tool.getRealUrl());
	    };
	
	    var getTitle = function(data){
	        var title = data.item.episode != null ? 'E'+data.item.episode : '';
	        title = data.item.season != null ? 'S'+data.item.season + title : title;
	        if(data.item.serie_title != null){
	            title = data.item.serie_title + (title != '' ? ' - ' + title : '');
	        }
	        return title;
	    };
	
	    var inVodFrame = function(){
	        var regexp = new RegExp('https:\/\/player\.pl(.*)');
	        var match = regexp.exec(window.location.href);
	        if(match[1]) {
	            window.sessionStorage.setItem(config.storage.topWindowLocation, 'https://vod.pl' + match[1]);
	        }
	    };
	
	    TVN.waitOnWrapper = function(){
	        if(!Tool.isTopWindow()) {
	            inVodFrame();
	        }
	
	        WrapperDetector.run(properties, TVN.waitOnWrapper);
	    };
	
	    return TVN;
	}(TVN || {}));
	
	var IPLA = (function(IPLA) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: 'div.player-wrapper:visible:first-child, div.promo-box:visible:first-child,' +
	                ' div.player-error-presentation:visible:first-child'
	        },
	        button: {
	            class: 'ipla_download_button'
	        },
	        chainSelector: function(){
	            return ['videos', 'subtitles'];
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://getmedia.redefine.pl/vods/get_vod/?cpid=1' +
	                        '&ua=www_iplatv_html5/12345&media_id=#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return IPLA.grabVideoData(output);
	                    }
	                })
	            ],
	            subtitles: [
	                new Step({
	                    urlTemplate: 'https://b2c.redefine.pl/rpc/navigation/',
	                    method: 'POST',
	                    methodParam: function(){
	                        return getParamsForSubtitles();
	                    },
	                    afterStep: function (output) {
	                        return IPLA.grabSubtitlesData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var getParamsForSubtitles = function(){
	        var mediaId = idParser();
	        return {
	            jsonrpc: "2.0",
	            id: 1,
	            method: "prePlayData",
	            params: {
	                userAgentData: {
	                    application: "firefox",
	                    portal: "ipla"
	                },
	                cpid: 1,
	                mediaId: mediaId
	            }
	        }
	    };
	
	    var idParser = function(){
	        var match = location.href.match(/[\a-z\d]{32}/);
	        if(match && match[0]) {
	            return match[0];
	        }
	
	        return grabVideoIdFromWatchingNowElement();
	    };
	
	    IPLA.waitOnWrapper = function(){
	        WrapperDetector.run(properties, IPLA.waitOnWrapper);
	    };
	
	    IPLA.grabSubtitlesData = function(data){
	        var items = [];
	        var subtitles = (((data.result || {}).mediaItem || {}).displayInfo || {}).subtitles || [];
	        subtitles.forEach(function(subtitle) {
	            items.push(new Format({
	                url: subtitle.src,
	                description: subtitle.name,
	                format: subtitle.format
	            }))
	        });
	        return {
	            cards: {subtitles: {items: items}}
	        };
	    };
	
	    IPLA.grabVideoData = function(data){
	        var items = [];
	        var vod = data.vod || {};
	        if(vod.copies && vod.copies.length > 0){
	            $.each(vod.copies, function( index, value ) {
	                items.push(new Format({
	                    bitrate: value.bitrate,
	                    url: value.url,
	                    quality: value.quality_p
	                }))
	            });
	            return {
	                title: vod.title,
	                cards: {videos: {items: items}}
	            }
	        }
	        throw new Exception(config.error.noSource, Tool.getRealUrl());
	    };
	
	    var grabVideoIdFromWatchingNowElement = function(){
	        var href = $('div.vod-image-wrapper__overlay').closest('a').attr('href');
	        if(href !== undefined){
	            var match = href.match(/[\a-z\d]{32}/);
	            if(match && match[0]){
	                return match[0];
	            }
	        }
	        return grabVideoIdFromHtmlElement();
	    };
	
	    var grabVideoIdFromHtmlElement = function(){
	        var frameSrc = $('app-commercial-wallpaper iframe:first-child').attr('src');
	        if(frameSrc !== undefined) {
	            return Tool.getUrlParameter('vid', frameSrc);
	        }
	
	        throw new Exception(config.error.id, Tool.getRealUrl());
	    };
	
	    return IPLA;
	}(IPLA || {}));
	
	var VOD = (function(VOD) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '#v_videoPlayer'
	        },
	        button: {
	            class: 'vod_download_button'
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://player-api.dreamlab.pl/?body[id]=#videoId&body[jsonrpc]=2.0' +
	                        '&body[method]=get_asset_detail&body[params][ID_Publikacji]=#videoId' +
	                        '&body[params][Service]=vod.onet.pl&content-type=application/jsonp' +
	                        '&x-onet-app=player.front.onetapi.pl&callback=',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return grabVideoData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var idParser = function () {
	        var id = $(".mvp").attr('id');
	        if(id !== undefined){
	            return id.match(/mvp:(.+)/)[1];
	        }
	
	        return parseFromJS();
	    };
	
	    var parseFromJS = function(){
	        var scripts = $('script[type="text/javascript"]').filter(':not([src])');
	        for (var i = 0; i < scripts.length; i++) {
	            var match = $(scripts[i]).text().match(/\"mvpId\"\s*:\s*\"(\d+\.\d+)\"/);
	            if(match && match[1]){
	                return match[1];
	            }
	        }
	
	        throw new Exception(config.error.id, Tool.getRealUrl());
	    };
	
	    var grabVideoData = function (data) {
	        var items = [];
	        var subtitlesItems = [];
	        var video = (((data.result || new Array())[0] || {}).formats || {}).wideo || {};
	        var meta = ((data.result || new Array())[0] || {}).meta || {};
	        var subtitles = meta.subtitles || [];
	        var videoData = video['mp4-uhd'] && video['mp4-uhd'].length > 0 ? video['mp4-uhd'] : video['mp4'];
	        if(videoData && videoData.length > 0){
	            videoData.forEach(function(value) {
	                items.push(new Format({
	                    quality: value.vertical_resolution,
	                    bitrate: value.video_bitrate,
	                    url: value.url
	                }))
	            });
	
	            subtitles.forEach(function(subtitle) {
	                subtitlesItems.push(new Format({
	                    url: subtitle.url,
	                    description: subtitle.name
	                }))
	            });
	
	            return {
	                title: meta.title,
	                cards: {
	                    videos: {items: items},
	                    subtitles: {items: subtitlesItems}
	                }
	            }
	        }
	        throw new Exception(config.error.noSource, Tool.getRealUrl());
	    };
	
	    var iplaDetected = function(){
	        return $('#v_videoPlayer div.pulsembed_embed').length > 0;
	    };
	
	    var workWithSubService = function(){
	        var src = 'https://pulsembed.eu';
	        var frameSelector = 'iframe[src^="' + src + '"]';
	
	        ElementDetector.detect(frameSelector, function () {
	            MessageReceiver.postUntilConfirmed({
	                windowReference: $(frameSelector).get(0).contentWindow,
	                origin: src,
	                message: {
	                    location: window.location.href
	                }
	            });
	        });
	    };
	
	    VOD.waitOnWrapper = function(){
	        if(iplaDetected()) {
	            workWithSubService();
	        }
	        else {
	            WrapperDetector.run(properties);
	        }
	    };
	
	    return VOD;
	}(VOD || {}));
	
	var VOD_IPLA = (function(VOD_IPLA) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '#player-wrapper'
	        },
	        button: {
	            class: 'vod_ipla_downlaod_button'
	        },
	        chainSelector: function(){
	            return ['videos', 'subtitles'];
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://getmedia.redefine.pl/vods/get_vod/?cpid=1&ua=www_iplatv_html5/12345' +
	                        '&media_id=#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return IPLA.grabVideoData(output);
	                    }
	                })
	            ],
	            subtitles: [
	                new Step({
	                    afterStep: function (output) {
	                        return parseSubtitleData();
	                    }
	                })
	            ]
	        }
	    });
	
	    var getJson = function(){
	        var match = $('script:not(:empty)').text().match(/(window\.CP\.embedSetup\()(.*)\);/);
	        var jsonObject = JSON.parse(match[2]);
	        return JSON.parse(jsonObject[0].media);
	    };
	
	    var idParser = function(){
	        try {
	            return (((getJson() || {}).result || {}).mediaItem || {}).id;
	        }
	        catch(e){
	            throw new Exception(config.error.id, Tool.getRealUrl());
	        }
	    };
	
	    var parseSubtitleData = function(){
	        return IPLA.grabSubtitlesData(getJson());
	    };
	
	    VOD_IPLA.waitOnWrapper = function(){
	        var callback = function(data) {
	            window.sessionStorage.setItem(config.storage.topWindowLocation, data.location);
	            WrapperDetector.run(properties);
	        };
	        MessageReceiver.awaitMessage({
	            origin: 'https://pulsembed.eu',
	            windowReference: window.parent
	        }, callback);
	    };
	
	    return VOD_IPLA;
	}(VOD_IPLA || {}));
	
	var WP = (function(WP) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '#Player0 > div'
	        },
	        button: {
	            class: 'wp_download_button material__category'
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://video.wp.pl/player/mid,#videoId,embed.json',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return grabVideoData(output);
	                    }
	                })
	            ]
	        }
	    });
	
	    var idParser = function () {
	        try {
	            return $('.identifier').attr('data-id');
	        }
	        catch(e){
	            throw new Exception(config.error.id, window.location.href);
	        }
	    };
	
	    var grabVideoData = function(data){
	        var items = [];
	        var urls = (data.clip || {}).url || {};
	        if(urls && urls.length > 0){
	            $.each(urls, function( index, value ) {
	                if(value.type === 'mp4@avc'){
	                    items.push(new Format({
	                        bitrate: value.quality,
	                        url: value.url,
	                        quality: value.resolution
	                    }));
	                }
	            });
	
	            return {
	                title: data.clip.title,
	                cards: {videos: {items: items}}
	            }
	        }
	        throw new Exception(config.error.noSource, window.location.href);
	    };
	
	    WP.waitOnWrapper = function(){
	        WrapperDetector.run(properties, WP.waitOnWrapper);
	    };
	
	    return WP;
	}(WP || {}));
	
	var CDA = (function(CDA) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '.pb-video-player-wrap'
	        },
	        button: {
	            class: 'cda_download_button',
	            click: function(){
	                clickButton();
	            }
	        }
	    });
	
	    var clickButton = function(){
	        var w = window.open();
	        try {
	            var url = $("video.pb-video-player").attr('src');
	            if(url !== undefined){
	                if(!url.match(/blank\.mp4/)){
	                    prepareResult(url, w);
	                }
	                else if(l !== undefined){
	                    prepareResult(l, w);
	                }
	                else {
	                    throw new Exception(config.error.id, window.location.href);
	                }
	            }
	        }catch(e){
	            DomTamper.handleError(e, w);
	        }
	    };
	
	    var prepareResult = function(url, w) {
	        var cardsData = properties.cardsData;
	        var title = $('meta[property="og:title"]');
	        var quality = $('.quality-btn-active');
	        cardsData.title = title.length > 0 ? title.attr('content').trim() : 'brak danych';
	        cardsData.cards['videos'].items = [new Format({
	            url: url,
	            quality: quality.length > 0 ? quality.text() : undefined
	        })];
	
	        DomTamper.createDocument(cardsData, w);
	    };
	
	    CDA.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return CDA;
	}(CDA || {}));
	
	var NINATEKA = (function(NINATEKA) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: '#videoPlayer, #player'
	        },
	        button: {
	            class: 'ninateka_download_button',
	            click: function(){
	                clickButton();
	            }
	        }
	    });
	
	    var prepareResult = function(url, w) {
	        var title = $('meta[name="title"]');
	        var cardsData = properties.cardsData;
	        cardsData.title = title.length > 0 ? title.attr('content').trim() : 'brak danych';
	        cardsData.cards['videos'].items = [new Format({
	            url: url,
	            quality: undefined
	        })];
	
	        DomTamper.createDocument(cardsData, w);
	    };
	
	    var getMp4Source = function(w, sources){
	        for(var i = 0; i < sources.length; i++){
	            if(sources[i].type && sources[i].type.match(/mp4/g)){
	                prepareResult(sources[i].src, w);
	                return;
	            }
	        }
	
	        throw new Exception(config.error.id, window.location.href);
	    };
	
	    var clickButton = function(){
	        var w = window.open();
	        try {
	            var videoPlayer = $('#videoPlayer').data('player-setup');
	            var sources = (videoPlayer || {}).sources || {};
	            if(sources.length > 0){
	                getMp4Source(w, sources);
	            }
	            else {
	                var scripts = $('script[type="text/javascript"]').filter(':not([src])');
	                for (var i = 0; i < scripts.length; i++) {
	                    var match = $(scripts[i]).text().match(/fn_\S+\(playerOptionsWithMainSource,\s*\d+\)\.sources/g);
	                    if(match && match[0]){
	                        sources = eval(match[0]);
	                        getMp4Source(w, sources);
	                        break;
	                    }
	                }
	            }
	        }catch(e){
	            DomTamper.handleError(e, w);
	        }
	    };
	
	    NINATEKA.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return NINATEKA;
	}(NINATEKA || {}));
	
	var ARTE = (function(ARTE) {
	    var properties = new Configurator({
	        wrapper: {
	            selector: 'div.avp-player'
	        },
	        button: {
	            class: 'arte_download_button',
	        },
	        asyncChains: {
	            videos: [
	                new Step({
	                    urlTemplate: 'https://api.arte.tv/api/player/v1/config/#langCode/#videoId',
	                    beforeStep: function (input) {
	                        return idParser();
	                    },
	                    afterStep: function (output) {
	                        return grabVideoData(output);
	                    }
	                })
	            ]
	        },
	        formatter: function(data) {
	            data.cards['videos'].items.sort(function (a, b) {
	                return  b.bitrate - a.bitrate;
	            });
	            data.cards['videos'].items.sort(function (a, b) {
	                var aLang = a.langCode, bLang = b.langCode;
	                if(aLang !== 'POL' && bLang !== 'POL'){
	                    return ('' + a.langCode).localeCompare(b.langCode);
	                }
	                else if(aLang === 'POL' && bLang !== 'POL'){
	                    return -1;
	                }
	                else if(aLang !== 'POL' && bLang === 'POL'){
	                    return 1;
	                }
	                else {
	                    return 0;
	                }
	            });
	        }
	    });
	
	    var detectLanguage = function() {
	        var regexp = new RegExp('https:\/\/www.arte\.tv\/(\\w{2})\/');
	        var match = regexp.exec(window.location.href);
	        return match[1];
	    };
	
	    var detectVideoId = function(){
	        var regexp = new RegExp('https:\/\/www.arte\.tv\/\\w{2}\/videos\/([\\w-]+)\/');
	        var match = regexp.exec(window.location.href);
	        return match[1];
	    };
	
	    var idParser = function() {
	        try {
	            return {
	                videoId: detectVideoId(),
	                langCode: detectLanguage()
	            };
	        }
	        catch(e){
	            throw new Exception(config.error.id, window.location.href);
	        }
	    };
	
	    var grabVideoData = function(data){
	        var items = [];
	        var title = (((data || {}).videoJsonPlayer || {}).eStat || {}).streamName || '';
	        var streams = ((data || {}).videoJsonPlayer || {}).VSR || {};
	        if(streams){
	            Object.keys(streams).filter(function(k, i) {
	                return k.startsWith("HTTPS");
	            }).forEach(function(k) {
	                var stream = streams[k];
	                items.push(new Format({
	                    bitrate: stream.bitrate,
	                    quality: stream.width + 'x' + stream.height,
	                    langCode: stream.versionShortLibelle,
	                    langDesc: stream.versionLibelle,
	                    url: stream.url
	                }));
	            });
	            return {
	                title: title,
	                cards: {videos: {items: items}}
	            }
	        }
	        throw new Exception(config.error.noSource, window.location.href);
	    };
	
	    ARTE.waitOnWrapper = function(){
	        WrapperDetector.run(properties);
	    };
	
	    return ARTE;
	}(ARTE || {}));
	
	var VOD_FRAME = (function(VOD_FRAME) {
	    VOD_FRAME.setup = function(){
	        var callback = function(data) {
	            var src = 'https://redir.atmcdn.pl';
	            var frameSelector = 'iframe[src^="' + src + '"]';
	
	            ElementDetector.detect(frameSelector, function () {
	                MessageReceiver.postUntilConfirmed({
	                    windowReference: $(frameSelector).get(0).contentWindow,
	                    origin: src,
	                    message: {
	                        location: data.location
	                    }
	                });
	            });
	        };
	        MessageReceiver.awaitMessage({
	            origin: 'https://vod.pl',
	            windowReference: window.parent
	        }, callback);
	    };
	
	    return VOD_FRAME;
	}(VOD_FRAME || {}));
	
	var Starter = (function(Starter) {
	    var tvZones = [
	        'bialystok', 'katowice', 'lodz', 'rzeszow', 'bydgoszcz', 'kielce', 'olsztyn', 'szczecin',
	        'gdansk', 'krakow', 'opole', 'warszawa', 'gorzow', 'lublin', 'poznan', 'wroclaw'
	    ];
	
	    var sources = [
	        {action: VOD_TVP.waitOnWrapper, pattern: /^https:\/\/vod\.tvp\.pl\/video\//},
	        {action: CYF_TVP.waitOnWrapper, pattern: /^https:\/\/cyfrowa\.tvp\.pl\/video\//},
	        {action: TVP_REG.waitOnWrapper, pattern: new RegExp('^https:\/\/(' + tvZones.join('|') + ')\.tvp\.pl\/\\d{6,}\/')},
	        {action: TVN.waitOnWrapper, pattern: /^https:\/\/(?:w{3}\.)?(?:tvn)?player\.pl\//},
	        {action: CDA.waitOnWrapper, pattern: /^https:\/\/.*\.cda\.pl\//},
	        {action: VOD.waitOnWrapper, pattern: /^https:\/\/vod.pl\//},
	        {action: VOD_IPLA.waitOnWrapper, pattern: /^https:\/\/.*\.redcdn.pl\/file\/o2\/redefine\/partner\//},
	        {action: IPLA.waitOnWrapper, pattern: /^https:\/\/www\.ipla\.tv\//},
	        {action: WP.waitOnWrapper, pattern: /^https:\/\/video\.wp\.pl\//},
	        {action: NINATEKA.waitOnWrapper, pattern: /^https:\/\/ninateka.pl\//},
	        {action: ARTE.waitOnWrapper, pattern: /^https:\/\/www.arte.tv\/.*\/videos\//},
	        {action: VOD_FRAME.setup, pattern: /^https:\/\/pulsembed\.eu\//}
	    ];
	
	    Starter.start = function() {
	        sources.some(function(source){
	            if(location.href.match(source.pattern)){
	                source.action();
	                return true;
	            }
	        });
	    };
	
	    return Starter;
	}(Starter || {}));
	
	$(document).ready(function(){
	    console.info('voddownloader with jQuery v' + $().jquery);
	    DomTamper.injectStyle(window, 'buttons_css');
	    Starter.start();
	});

}).bind(this)(jQuery, platform, Waves);
