all: pages

pages: $(patsubst src/%,pages/%,$(shell find src -type f))

pages/%.md: src/%.md head.html Makefile
	@mkdir -p $(dir $@)
	@sed -E 's|(href="/$(word 2, $(subst /, ,$(dir $<)))")|class="current" \1|' head.html > $(basename $@).html
	pandoc -f gfm -t html $< >> $(basename $@).html

pages/%: src/%
	@mkdir -p $(dir $@)
	@cp $< $@

clean:
	rm -rf pages

watch:
	while true; do find src head.html Makefile | entr -d make; done

serve:
	@trap 'kill -KILL 0' SIGINT; \
	make watch & \
	npx serve pages & \
	wait

.PHONY: all pages clean watch serve
