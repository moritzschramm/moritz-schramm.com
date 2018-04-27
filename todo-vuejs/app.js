Vue.component('create-todo-button', {
    data: function() {
        return {
            text: "",
        };
    },
    methods: {
        emitCreateTodo: function() {
            if(this.text != "") {

                this.$emit('create-todo', this.text);
                this.text = "";
            }
        }
    },
    template: '<div class="todo-list-item level is-mobile">                                                         \
                <div class="level-left">                                                                            \
                    <div class="level-item">                                                                        \
                        <label class="checkbox"><input type="checkbox" disabled></label>                            \
                    </div>                                                                                          \
                    <div class="leve-item">                                                                         \
                        <input id="note-input" class="input is-medium is-static" type="text" placeholder="New Todo" \
                            v-model.trim="text"                                                                     \
                            v-on:keydown.enter="emitCreateTodo">                                                    \
                    </div>                                                                                          \
                </div>                                                                                              \
                <div class="level-right">                                                                           \
                    <div class="level-item">                                                                        \
                        <button class="button is-success is-medium" v-on:click="emitCreateTodo">                    \
                            <span class="icon">                                                                     \
                                <i class="mdi mdi-24px mdi-plus"></i>                                               \
                            </span>                                                                                 \
                            <span>Create</span>                                                                     \
                        </button>                                                                                   \
                    </div>                                                                                          \
                </div>                                                                                              \
            </div>                                                                                                  \
    '
});

Vue.component('order-select', {
    props: {
        loader: Boolean,
        value: {
            type: String,
            default: "created_at"
        }
    },
    methods: {
        selectChanged: function(order) {
            this.$emit('input', order);
            this.$emit('order-changed', order);
        }
    },
    template: '<div class="level-item">                                                             \
                    <span style="padding-right: 10px;">Order by: </span>                            \
                    <div class="select"                                                             \
                            v-bind:class="{\'is-loading\': loader}">                                \
                        <select v-model="value" v-on:input="selectChanged($event.target.value)">    \
                            <option value="created_at">Date</option>                                \
                            <option value="note">Name</option>                                      \
                        </select>                                                                   \
                    </div>                                                                          \
                </div>'
});

Vue.component('todo', {
    props: ["todo", "index"],
    methods: {
        emitToggle: function() {

            this.$emit('toggle', this.todo);
        },
        emitEdit: function() {

            this.$emit('edit', this.todo);
        },
        emitDelete: function() {

            this.$emit('delete', {todo: this.todo, index: this.index});
        }
    },
    template: '<div class="todo-list-item level is-mobile">                                                             \
                <div class="level-left">                                                                                \
                    <div class="level-item">                                                                            \
                        <label class="checkbox">                                                                        \
                            <input type="checkbox"                                                                      \
                                    v-bind:checked="todo.done"                                                          \
                                    v-on:click="emitToggle">                                                            \
                        </label>                                                                                        \
                    </div>                                                                                              \
                    <div class="level-item">                                                                            \
                        <input type="text" class="input is-medium is-static" placeholder="Todo"                         \                                                                   \
                            v-on:click="$event.target.focus()"                                                          \
                            v-bind:class="{\'line-through\': todo.done}"                                                \
                            v-on:blur="emitEdit"                                                                        \
                            v-on:keydown.enter="emitEdit(); document.getElementById(\'note-input\').focus();"           \
                            v-model.trim="todo.note">                                                                   \
                    </div>                                                                                              \
                </div>                                                                                                  \
                <div class="level-right">                                                                               \
                    <div class="level-item">                                                                            \
                        <button class="button is-danger is-small"                                                       \
                                v-on:click="emitDelete">                                                                \
                                <span class="icon"><i class="mdi mdi-18px mdi-close"></i></span>                        \
                        </button>                                                                                       \
                    </div>                                                                                              \
                </div>                                                                                                  \
            </div>                                                                                                      \
    '
});



var app = new Vue({
  el: '#app',  
  data: {
    todos: [],
    currentId: 1,
    maxId: 9999,
    loading: false,
    orderSelection: "created_at"
  },
  created: function() {

  },
  mounted: function() {

    document.getElementById('note-input').focus();
  },
  methods: {
    orderChanged: function(order) {

        this.sortTodos();
        document.getElementById('note-input').focus();
    },
    sortTodos: function() {

        var order = this.orderSelection;
        this.todos.sort(function(a, b) {
            if(a[order] < b[order]) {
                return -1;
            } else if (a[order] > b[order]) {
                return 1;
            }
            return 0;
        });
    },
    addTodo: function(text) {

        this.todos.push({id: this.currentId, note: text, done: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString()});
        this.sortTodos();
        this.currentId++;
        document.getElementById('note-input').focus();
    },
    toggleTodo: function(todo) {

        todo.done = !todo.done;

        this.editTodo(todo);
    },
    editTodo: function(todo) {

        todo.updated_at = new Date().toISOString();
        this.sortTodos();
    },
    deleteTodo: function(event) {

        var todo = event.todo;
        var index = event.index;
        this.todos.splice(index, 1);

        document.getElementById('note-input').focus();
    }
  }
});