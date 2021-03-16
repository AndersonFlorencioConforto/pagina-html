+function ($) {
    'use strict';
  
    // VALIDATOR CLASS DEFINITION
    // ==========================
  
    function getValue($el) {
      return $el.is('[type="checkbox"]') ? $el.prop('checked')                                     :
             $el.is('[type="radio"]')    ? !!$('[name="' + $el.attr('name') + '"]:checked').length :
             $el.is('select[multiple]')  ? ($el.val() || []).length                                :
                                           $el.val()
    }
  
    var Validator = function (element, options) {
      this.options    = options
      this.validators = $.extend({}, Validator.VALIDATORS, options.custom)
      this.$element   = $(element)
      this.$btn       = $('button[type="submit"], input[type="submit"]')
                          .filter('[form="' + this.$element.attr('id') + '"]')
                          .add(this.$element.find('input[type="submit"], button[type="submit"]'))
  
      this.update()
  
      this.$element.on('input.bs.validator change.bs.validator focusout.bs.validator', $.proxy(this.onInput, this))
      this.$element.on('submit.bs.validator', $.proxy(this.onSubmit, this))
      this.$element.on('reset.bs.validator', $.proxy(this.reset, this))
  
      this.$element.find('[data-match]').each(function () {
        var $this  = $(this)
        var target = $this.attr('data-match')
  
        $(target).on('input.bs.validator', function (e) {
          getValue($this) && $this.trigger('input.bs.validator')
        })
      })
  
      // run validators for fields with values, but don't clobber server-side errors
      this.$inputs.filter(function () {
        return getValue($(this)) && !$(this).closest('.has-error').length
      }).trigger('focusout')
  
      this.$element.attr('novalidate', true) // disable automatic native validation
    }
  
    Validator.VERSION = '0.11.9'
  
    Validator.INPUT_SELECTOR = ':input:not([type="hidden"], [type="submit"], [type="reset"], button)'
  
    Validator.FOCUS_OFFSET = 20
  
    Validator.DEFAULTS = {
      delay: 500,
      html: false,
      disable: true,
      focus: true,
      custom: {},
      errors: {
        match: 'Does not match',
        minlength: 'Not long enough'
      },
      feedback: {
        success: 'glyphicon-ok',
        error: 'glyphicon-remove'
      }
    }
  
    Validator.VALIDATORS = {
      'native': function ($el) {
        var el = $el[0]
        if (el.checkValidity) {
          return !el.checkValidity() && !el.validity.valid && (el.validationMessage || "error!")
        }
      },
      'match': function ($el) {
        var target = $el.attr('data-match')
        return $el.val() !== $(target).val() && Validator.DEFAULTS.errors.match
      },
      'minlength': function ($el) {
        var minlength = $el.attr('data-minlength')
        return $el.val().length < minlength && Validator.DEFAULTS.errors.minlength
      }
    }
  
    Validator.prototype.update = function () {
      var self = this
  
      this.$inputs = this.$element.find(Validator.INPUT_SELECTOR)
        .add(this.$element.find('[data-validate="true"]'))
        .not(this.$element.find('[data-validate="false"]')
          .each(function () { self.clearErrors($(this)) })
        )
  
      this.toggleSubmit()
  
      return this
    }
  
    Validator.prototype.onInput = function (e) {
      var self        = this
      var $el         = $(e.target)
      var deferErrors = e.type !== 'focusout'
  
      if (!this.$inputs.is($el)) return
  
      this.validateInput($el, deferErrors).done(function () {
        self.toggleSubmit()
      })
    }
  
    Validator.prototype.validateInput = function ($el, deferErrors) {
      var value      = getValue($el)
      var prevErrors = $el.data('bs.validator.errors')
  
      if ($el.is('[type="radio"]')) $el = this.$element.find('input[name="' + $el.attr('name') + '"]')
  
      var e = $.Event('validate.bs.validator', {relatedTarget: $el[0]})
      this.$element.trigger(e)
      if (e.isDefaultPrevented()) return
  
      var self = this
  
      return this.runValidators($el).done(function (errors) {
        $el.data('bs.validator.errors', errors)
  
        errors.length
          ? deferErrors ? self.defer($el, self.showErrors) : self.showErrors($el)
          : self.clearErrors($el)
  
        if (!prevErrors || errors.toString() !== prevErrors.toString()) {
          e = errors.length
            ? $.Event('invalid.bs.validator', {relatedTarget: $el[0], detail: errors})
            : $.Event('valid.bs.validator', {relatedTarget: $el[0], detail: prevErrors})
  
          self.$element.trigger(e)
        }
  
        self.toggleSubmit()
  
        self.$element.trigger($.Event('validated.bs.validator', {relatedTarget: $el[0]}))
      })
    }
  
  
    Validator.prototype.runValidators = function ($el) {
      var errors   = []
      var deferred = $.Deferred()
  
      $el.data('bs.validator.deferred') && $el.data('bs.validator.deferred').reject()
      $el.data('bs.validator.deferred', deferred)
  
      function getValidatorSpecificError(key) {
        return $el.attr('data-' + key + '-error')
      }
  
      function getValidityStateError() {
        var validity = $el[0].validity
        return validity.typeMismatch    ? $el.attr('data-type-error')
             : validity.patternMismatch ? $el.attr('data-pattern-error')
             : validity.stepMismatch    ? $el.attr('data-step-error')
             : validity.rangeOverflow   ? $el.attr('data-max-error')
             : validity.rangeUnderflow  ? $el.attr('data-min-error')
             : validity.valueMissing    ? $el.attr('data-required-error')
             :                            null
      }
  
      function getGenericError() {
        return $el.attr('data-error')
      }
  
      function getErrorMessage(key) {
        return getValidatorSpecificError(key)
            || getValidityStateError()
            || getGenericError()
      }
  
      $.each(this.validators, $.proxy(function (key, validator) {
        var error = null
        if ((getValue($el) || $el.attr('required')) &&
            ($el.attr('data-' + key) !== undefined || key == 'native') &&
            (error = validator.call(this, $el))) {
           error = getErrorMessage(key) || error
          !~errors.indexOf(error) && errors.push(error)
        }
      }, this))
  
      if (!errors.length && getValue($el) && $el.attr('data-remote')) {
        this.defer($el, function () {
          var data = {}
          data[$el.attr('name')] = getValue($el)
          $.get($el.attr('data-remote'), data)
            .fail(function (jqXHR, textStatus, error) { errors.push(getErrorMessage('remote') || error) })
            .always(function () { deferred.resolve(errors)})
        })
      } else deferred.resolve(errors)
  
      return deferred.promise()
    }
  
    Validator.prototype.validate = function () {
      var self = this
  
      $.when(this.$inputs.map(function (el) {
        return self.validateInput($(this), false)
      })).then(function () {
        self.toggleSubmit()
        self.focusError()
      })
  
      return this
    }
  
    Validator.prototype.focusError = function () {
      if (!this.options.focus) return
  
      var $input = this.$element.find(".has-error :input:first")
      if ($input.length === 0) return
  
      $('html, body').animate({scrollTop: $input.offset().top - Validator.FOCUS_OFFSET}, 250)
      $input.focus()
    }
  
    Validator.prototype.showErrors = function ($el) {
      var method = this.options.html ? 'html' : 'text'
      var errors = $el.data('bs.validator.errors')
      var $group = $el.closest('.form-group')
      var $block = $group.find('.help-block.with-errors')
      var $feedback = $group.find('.form-control-feedback')
  
      if (!errors.length) return
  
      errors = $('<ul/>')
        .addClass('list-unstyled')
        .append($.map(errors, function (error) { return $('<li/>')[method](error) }))
  
      $block.data('bs.validator.originalContent') === undefined && $block.data('bs.validator.originalContent', $block.html())
      $block.empty().append(errors)
      $group.addClass('has-error has-danger')
  
      $group.hasClass('has-feedback')
        && $feedback.removeClass(this.options.feedback.success)
        && $feedback.addClass(this.options.feedback.error)
        && $group.removeClass('has-success')
    }
  
    Validator.prototype.clearErrors = function ($el) {
      var $group = $el.closest('.form-group')
      var $block = $group.find('.help-block.with-errors')
      var $feedback = $group.find('.form-control-feedback')
  
      $block.html($block.data('bs.validator.originalContent'))
      $group.removeClass('has-error has-danger has-success')
  
      $group.hasClass('has-feedback')
        && $feedback.removeClass(this.options.feedback.error)
        && $feedback.removeClass(this.options.feedback.success)
        && getValue($el)
        && $feedback.addClass(this.options.feedback.success)
        && $group.addClass('has-success')
    }
  
    Validator.prototype.hasErrors = function () {
      function fieldErrors() {
        return !!($(this).data('bs.validator.errors') || []).length
      }
  
      return !!this.$inputs.filter(fieldErrors).length
    }
  
    Validator.prototype.isIncomplete = function () {
      function fieldIncomplete() {
        var value = getValue($(this))
        return !(typeof value == "string" ? $.trim(value) : value)
      }
  
      return !!this.$inputs.filter('[required]').filter(fieldIncomplete).length
    }
  
    Validator.prototype.onSubmit = function (e) {
      this.validate()
      if (this.isIncomplete() || this.hasErrors()) e.preventDefault()
    }
  
    Validator.prototype.toggleSubmit = function () {
      if (!this.options.disable) return
      this.$btn.toggleClass('disabled', this.isIncomplete() || this.hasErrors())
    }
  
    Validator.prototype.defer = function ($el, callback) {
      callback = $.proxy(callback, this, $el)
      if (!this.options.delay) return callback()
      window.clearTimeout($el.data('bs.validator.timeout'))
      $el.data('bs.validator.timeout', window.setTimeout(callback, this.options.delay))
    }
  
    Validator.prototype.reset = function () {
      this.$element.find('.form-control-feedback')
        .removeClass(this.options.feedback.error)
        .removeClass(this.options.feedback.success)
  
      this.$inputs
        .removeData(['bs.validator.errors', 'bs.validator.deferred'])
        .each(function () {
          var $this = $(this)
          var timeout = $this.data('bs.validator.timeout')
          window.clearTimeout(timeout) && $this.removeData('bs.validator.timeout')
        })
  
      this.$element.find('.help-block.with-errors')
        .each(function () {
          var $this = $(this)
          var originalContent = $this.data('bs.validator.originalContent')
  
          $this
            .removeData('bs.validator.originalContent')
            .html(originalContent)
        })
  
      this.$btn.removeClass('disabled')
  
      this.$element.find('.has-error, .has-danger, .has-success').removeClass('has-error has-danger has-success')
  
      return this
    }
  
    Validator.prototype.destroy = function () {
      this.reset()
  
      this.$element
        .removeAttr('novalidate')
        .removeData('bs.validator')
        .off('.bs.validator')
  
      this.$inputs
        .off('.bs.validator')
  
      this.options    = null
      this.validators = null
      this.$element   = null
      this.$btn       = null
      this.$inputs    = null
  
      return this
    }
  
    // VALIDATOR PLUGIN DEFINITION
    // ===========================
  
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var options = $.extend({}, Validator.DEFAULTS, $this.data(), typeof option == 'object' && option)
        var data    = $this.data('bs.validator')
  
        if (!data && option == 'destroy') return
        if (!data) $this.data('bs.validator', (data = new Validator(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.validator
  
    $.fn.validator             = Plugin
    $.fn.validator.Constructor = Validator
  
  
    // VALIDATOR NO CONFLICT
    // =====================
  
    $.fn.validator.noConflict = function () {
      $.fn.validator = old
      return this
    }
  
  
    // VALIDATOR DATA-API
    // ==================
  
    $(window).on('load', function () {
      $('form[data-toggle="validator"]').each(function () {
        var $form = $(this)
        Plugin.call($form, $form.data())
      })
    })
  
  }(jQuery);

  +function(a){"use strict";function b(b){return b.is('[type="checkbox"]')?b.prop("checked"):b.is('[type="radio"]')?!!a('[name="'+b.attr("name")+'"]:checked').length:b.is("select[multiple]")?(b.val()||[]).length:b.val()}function c(b){return this.each(function(){var c=a(this),e=a.extend({},d.DEFAULTS,c.data(),"object"==typeof b&&b),f=c.data("bs.validator");(f||"destroy"!=b)&&(f||c.data("bs.validator",f=new d(this,e)),"string"==typeof b&&f[b]())})}var d=function(c,e){this.options=e,this.validators=a.extend({},d.VALIDATORS,e.custom),this.$element=a(c),this.$btn=a('button[type="submit"], input[type="submit"]').filter('[form="'+this.$element.attr("id")+'"]').add(this.$element.find('input[type="submit"], button[type="submit"]')),this.update(),this.$element.on("input.bs.validator change.bs.validator focusout.bs.validator",a.proxy(this.onInput,this)),this.$element.on("submit.bs.validator",a.proxy(this.onSubmit,this)),this.$element.on("reset.bs.validator",a.proxy(this.reset,this)),this.$element.find("[data-match]").each(function(){var c=a(this),d=c.attr("data-match");a(d).on("input.bs.validator",function(){b(c)&&c.trigger("input.bs.validator")})}),this.$inputs.filter(function(){return b(a(this))&&!a(this).closest(".has-error").length}).trigger("focusout"),this.$element.attr("novalidate",!0)};d.VERSION="0.11.9",d.INPUT_SELECTOR=':input:not([type="hidden"], [type="submit"], [type="reset"], button)',d.FOCUS_OFFSET=20,d.DEFAULTS={delay:500,html:!1,disable:!0,focus:!0,custom:{},errors:{match:"Does not match",minlength:"Not long enough"},feedback:{success:"glyphicon-ok",error:"glyphicon-remove"}},d.VALIDATORS={"native":function(a){var b=a[0];return b.checkValidity?!b.checkValidity()&&!b.validity.valid&&(b.validationMessage||"error!"):void 0},match:function(b){var c=b.attr("data-match");return b.val()!==a(c).val()&&d.DEFAULTS.errors.match},minlength:function(a){var b=a.attr("data-minlength");return a.val().length<b&&d.DEFAULTS.errors.minlength}},d.prototype.update=function(){var b=this;return this.$inputs=this.$element.find(d.INPUT_SELECTOR).add(this.$element.find('[data-validate="true"]')).not(this.$element.find('[data-validate="false"]').each(function(){b.clearErrors(a(this))})),this.toggleSubmit(),this},d.prototype.onInput=function(b){var c=this,d=a(b.target),e="focusout"!==b.type;this.$inputs.is(d)&&this.validateInput(d,e).done(function(){c.toggleSubmit()})},d.prototype.validateInput=function(c,d){var e=(b(c),c.data("bs.validator.errors"));c.is('[type="radio"]')&&(c=this.$element.find('input[name="'+c.attr("name")+'"]'));var f=a.Event("validate.bs.validator",{relatedTarget:c[0]});if(this.$element.trigger(f),!f.isDefaultPrevented()){var g=this;return this.runValidators(c).done(function(b){c.data("bs.validator.errors",b),b.length?d?g.defer(c,g.showErrors):g.showErrors(c):g.clearErrors(c),e&&b.toString()===e.toString()||(f=b.length?a.Event("invalid.bs.validator",{relatedTarget:c[0],detail:b}):a.Event("valid.bs.validator",{relatedTarget:c[0],detail:e}),g.$element.trigger(f)),g.toggleSubmit(),g.$element.trigger(a.Event("validated.bs.validator",{relatedTarget:c[0]}))})}},d.prototype.runValidators=function(c){function d(a){return c.attr("data-"+a+"-error")}function e(){var a=c[0].validity;return a.typeMismatch?c.attr("data-type-error"):a.patternMismatch?c.attr("data-pattern-error"):a.stepMismatch?c.attr("data-step-error"):a.rangeOverflow?c.attr("data-max-error"):a.rangeUnderflow?c.attr("data-min-error"):a.valueMissing?c.attr("data-required-error"):null}function f(){return c.attr("data-error")}function g(a){return d(a)||e()||f()}var h=[],i=a.Deferred();return c.data("bs.validator.deferred")&&c.data("bs.validator.deferred").reject(),c.data("bs.validator.deferred",i),a.each(this.validators,a.proxy(function(a,d){var e=null;!b(c)&&!c.attr("required")||void 0===c.attr("data-"+a)&&"native"!=a||!(e=d.call(this,c))||(e=g(a)||e,!~h.indexOf(e)&&h.push(e))},this)),!h.length&&b(c)&&c.attr("data-remote")?this.defer(c,function(){var d={};d[c.attr("name")]=b(c),a.get(c.attr("data-remote"),d).fail(function(a,b,c){h.push(g("remote")||c)}).always(function(){i.resolve(h)})}):i.resolve(h),i.promise()},d.prototype.validate=function(){var b=this;return a.when(this.$inputs.map(function(){return b.validateInput(a(this),!1)})).then(function(){b.toggleSubmit(),b.focusError()}),this},d.prototype.focusError=function(){if(this.options.focus){var b=this.$element.find(".has-error :input:first");0!==b.length&&(a("html, body").animate({scrollTop:b.offset().top-d.FOCUS_OFFSET},250),b.focus())}},d.prototype.showErrors=function(b){var c=this.options.html?"html":"text",d=b.data("bs.validator.errors"),e=b.closest(".form-group"),f=e.find(".help-block.with-errors"),g=e.find(".form-control-feedback");d.length&&(d=a("<ul/>").addClass("list-unstyled").append(a.map(d,function(b){return a("<li/>")[c](b)})),void 0===f.data("bs.validator.originalContent")&&f.data("bs.validator.originalContent",f.html()),f.empty().append(d),e.addClass("has-error has-danger"),e.hasClass("has-feedback")&&g.removeClass(this.options.feedback.success)&&g.addClass(this.options.feedback.error)&&e.removeClass("has-success"))},d.prototype.clearErrors=function(a){var c=a.closest(".form-group"),d=c.find(".help-block.with-errors"),e=c.find(".form-control-feedback");d.html(d.data("bs.validator.originalContent")),c.removeClass("has-error has-danger has-success"),c.hasClass("has-feedback")&&e.removeClass(this.options.feedback.error)&&e.removeClass(this.options.feedback.success)&&b(a)&&e.addClass(this.options.feedback.success)&&c.addClass("has-success")},d.prototype.hasErrors=function(){function b(){return!!(a(this).data("bs.validator.errors")||[]).length}return!!this.$inputs.filter(b).length},d.prototype.isIncomplete=function(){function c(){var c=b(a(this));return!("string"==typeof c?a.trim(c):c)}return!!this.$inputs.filter("[required]").filter(c).length},d.prototype.onSubmit=function(a){this.validate(),(this.isIncomplete()||this.hasErrors())&&a.preventDefault()},d.prototype.toggleSubmit=function(){this.options.disable&&this.$btn.toggleClass("disabled",this.isIncomplete()||this.hasErrors())},d.prototype.defer=function(b,c){return c=a.proxy(c,this,b),this.options.delay?(window.clearTimeout(b.data("bs.validator.timeout")),void b.data("bs.validator.timeout",window.setTimeout(c,this.options.delay))):c()},d.prototype.reset=function(){return this.$element.find(".form-control-feedback").removeClass(this.options.feedback.error).removeClass(this.options.feedback.success),this.$inputs.removeData(["bs.validator.errors","bs.validator.deferred"]).each(function(){var b=a(this),c=b.data("bs.validator.timeout");window.clearTimeout(c)&&b.removeData("bs.validator.timeout")}),this.$element.find(".help-block.with-errors").each(function(){var b=a(this),c=b.data("bs.validator.originalContent");b.removeData("bs.validator.originalContent").html(c)}),this.$btn.removeClass("disabled"),this.$element.find(".has-error, .has-danger, .has-success").removeClass("has-error has-danger has-success"),this},d.prototype.destroy=function(){return this.reset(),this.$element.removeAttr("novalidate").removeData("bs.validator").off(".bs.validator"),this.$inputs.off(".bs.validator"),this.options=null,this.validators=null,this.$element=null,this.$btn=null,this.$inputs=null,this};var e=a.fn.validator;a.fn.validator=c,a.fn.validator.Constructor=d,a.fn.validator.noConflict=function(){return a.fn.validator=e,this},a(window).on("load",function(){a('form[data-toggle="validator"]').each(function(){var b=a(this);c.call(b,b.data())})})}(jQuery);